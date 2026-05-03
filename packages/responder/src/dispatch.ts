/**
 * Inbound-event dispatcher.
 *
 * Pure routing logic given:
 *   - parsed `ChannelInboundResult` (sender, thread, command, replyInChannel)
 *   - resolved Paperclip agent + per-call API key
 *   - PaperclipClient instance
 *   - ThreadStore instance
 *   - the channel id (composite key)
 *
 * Translates the slash-command grammar (per arch doc §392) into Paperclip
 * REST calls and an in-channel confirmation reply.
 *
 * NOT done here:
 *   - Channel-side parsing (lives in each channel's parseInboundEvent)
 *   - Agent identity resolution (lives in agents/lookup.ts)
 *   - Active-issue thread binding from the OUTBOUND side — that's the
 *     adapter's responsibility (Phase 4 wires it via the channel.send
 *     `externalId`); the dispatcher only READS the binding here.
 */
import type { ChannelInboundResult, CommandResult } from "@d1dx/paperclip-human-bridge-shared";
import { HELP_TEXT, type PaperclipClient } from "@d1dx/paperclip-human-bridge-shared";
import type { ResolvedAgent } from "./agents/lookup.js";
import type { ThreadStore } from "./state/thread-state.js";

export interface DispatchInput {
  channel: string;
  inbound: ChannelInboundResult;
  agent: ResolvedAgent;
  paperclip: PaperclipClient;
  threads: ThreadStore;
}

export interface DispatchResult {
  /** What action ran. */
  action:
    | "comment"
    | "done"
    | "block"
    | "question"
    | "attachment"
    | "help"
    | "no-active-issue"
    | "unknown";
  issueId?: string;
  replyText: string;
}

export async function dispatchInbound(input: DispatchInput): Promise<DispatchResult> {
  const { channel, inbound, agent, paperclip, threads } = input;

  // /help is the only path that doesn't need a bound active issue.
  if (inbound.command.kind === "help") {
    await inbound.replyInChannel(HELP_TEXT);
    return { action: "help", replyText: HELP_TEXT };
  }

  const thread = await threads.get(channel, inbound.threadExternalId);
  if (!thread) {
    const msg =
      "No active Paperclip issue is bound to this thread. Wait for an assignment, " +
      "or send `/help` to see the command grammar.";
    await inbound.replyInChannel(msg);
    return { action: "no-active-issue", replyText: msg };
  }

  // Sanity: the bound thread's agent should match the resolved sender.
  // If not, refuse — wrong-thread-wrong-agent is exactly the cross-channel
  // impersonation risk the arch doc flags.
  if (thread.agentId !== agent.entry.id) {
    const msg = `Thread is bound to agent ${thread.agentId}; sender resolved to agent ${agent.entry.id}. Refusing dispatch.`;
    await inbound.replyInChannel(msg);
    return { action: "unknown", issueId: thread.activeIssueId, replyText: msg };
  }

  const issueId = thread.activeIssueId;
  await threads.touch(channel, inbound.threadExternalId);

  const reply = await routeCommand({
    issueId,
    command: inbound.command,
    paperclip,
    apiKey: agent.apiKey,
  });

  await inbound.replyInChannel(reply.replyText);
  return { ...reply, issueId };
}

interface RouteInput {
  issueId: string;
  command: CommandResult;
  paperclip: PaperclipClient;
  apiKey: string;
}

async function routeCommand(input: RouteInput): Promise<Omit<DispatchResult, "issueId">> {
  const { issueId, command, paperclip, apiKey } = input;
  switch (command.kind) {
    case "comment": {
      await paperclip.createComment(issueId, command.body, apiKey);
      return { action: "comment", replyText: "Comment posted." };
    }
    case "done": {
      await paperclip.createWorkProduct(
        issueId,
        { title: "Done", body: command.summary ?? "Marked done by agent." },
        apiKey,
      );
      await paperclip.patchIssueStatus(issueId, "done", apiKey);
      return { action: "done", replyText: "Marked done. Work product created." };
    }
    case "block": {
      await paperclip.patchIssueStatus(issueId, "blocked", apiKey);
      await paperclip.createComment(issueId, `Blocked: ${command.reason}`, apiKey);
      return { action: "block", replyText: `Marked blocked: ${command.reason}` };
    }
    case "question": {
      await paperclip.createInteraction(
        issueId,
        { kind: "question", body: command.body },
        apiKey,
      );
      return { action: "question", replyText: "Question sent to assigner." };
    }
    case "attachment": {
      // v0.1: attachments forwarded as a work-product whose body is the
      // text plus a list of attachment refs. Actual upload-to-Paperclip
      // pipeline is Phase 6/10 (needs the Chat→Paperclip media bridge).
      await paperclip.createWorkProduct(
        issueId,
        {
          title: "Attachment",
          body: command.body || "(no text)",
          attachmentIds: command.attachmentRefs,
        },
        apiKey,
      );
      return { action: "attachment", replyText: "Attachment recorded." };
    }
    case "unknown": {
      return {
        action: "unknown",
        replyText:
          "Sorry — couldn't parse that. Try `/help` for the command grammar.",
      };
    }
    case "help": {
      // Handled at the top of dispatchInbound.
      return { action: "help", replyText: HELP_TEXT };
    }
  }
}
