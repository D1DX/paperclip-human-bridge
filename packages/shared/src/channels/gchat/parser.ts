/**
 * Google Chat event parser.
 *
 * Receives the raw inbound HTTP request from Chat, verifies the
 * `X-Verification-Token` header against `GCHAT_VERIFICATION_TOKEN`
 * env, extracts sender/thread/message from the JSON body, runs the
 * channel-neutral command parser, and returns a `ChannelInboundResult`
 * the responder turns into Paperclip REST calls.
 *
 * The `replyInChannel` closure captures the service account JSON +
 * thread name so the responder can call it without knowing Chat
 * internals.
 *
 * Event shape reference:
 * https://developers.google.com/workspace/chat/api/reference/rest/v1/Event
 */
import { parseCommand } from "../../commands.js";
import type {
  ChannelInboundEvent,
  ChannelInboundResult,
} from "../registry.js";
import { sendDmMessage, type ServiceAccountKey } from "./client.js";

interface ChatMessageEvent {
  type?: string; // "MESSAGE" | "ADDED_TO_SPACE" | ...
  user?: { name?: string; displayName?: string };
  space?: { name?: string };
  message?: {
    name?: string;
    text?: string;
    thread?: { name?: string };
    attachment?: Array<{ name?: string; contentName?: string }>;
  };
}

export interface GchatParserDeps {
  /** Loaded service account JSON; used by the reply closure. */
  serviceAccount: ServiceAccountKey;
  /** Verification token to compare against the inbound header. */
  verificationToken: string;
}

/**
 * Build a parser bound to a service account + verification token.
 * The returned function matches the `Channel.parseInboundEvent`
 * signature.
 */
export function makeGchatParser(deps: GchatParserDeps) {
  return async function parseGchatEvent(
    evt: ChannelInboundEvent,
  ): Promise<ChannelInboundResult> {
    const headerToken = evt.request.headers.get("X-Verification-Token");
    if (!headerToken) {
      throw new Error(
        "[gchat parser] missing X-Verification-Token header — request rejected.",
      );
    }
    if (headerToken !== deps.verificationToken) {
      throw new Error(
        "[gchat parser] X-Verification-Token mismatch — request rejected.",
      );
    }

    const body = (await evt.request.json()) as ChatMessageEvent;

    if (body.type && body.type !== "MESSAGE") {
      throw new Error(
        `[gchat parser] event type "${body.type}" not supported in v0.1 (only MESSAGE).`,
      );
    }

    const senderExternalId = body.user?.name;
    const spaceName = body.space?.name;
    const threadExternalId = body.message?.thread?.name;
    const messageText = body.message?.text ?? "";
    const attachmentRefs = (body.message?.attachment ?? [])
      .map((a) => a.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);

    if (!senderExternalId) {
      throw new Error("[gchat parser] event missing user.name (sender id).");
    }
    if (!spaceName) {
      throw new Error("[gchat parser] event missing space.name.");
    }
    if (!threadExternalId) {
      throw new Error("[gchat parser] event missing message.thread.name.");
    }

    const command = parseCommand({ text: messageText, attachmentRefs });

    // The reply closure sends back into the SAME thread.
    // threadKey = thread resource name's last segment (Chat uses the
    // bare thread name as the reply key).
    const threadKeyMatch = threadExternalId.match(/threads\/([^/]+)$/);
    const threadKey = threadKeyMatch?.[1];

    const replyInChannel = async (text: string) => {
      await sendDmMessage(deps.serviceAccount, spaceName, text, threadKey);
    };

    return {
      senderExternalId,
      threadExternalId,
      command,
      replyInChannel,
    };
  };
}
