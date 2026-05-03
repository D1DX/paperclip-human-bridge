/**
 * @d1dx/paperclip-human-adapter
 *
 * Paperclip plugin entry point. Loaded by Paperclip's plugin store
 * (`adapter-plugins/node_modules/@d1dx/paperclip-human-adapter`).
 *
 * Plugin contract (verified against Paperclip upstream commit
 * 685ee84e4a9c33d37d3c9900cc810c3a9d2f373c):
 *
 *   - Module exports `createServerAdapter()`
 *   - Returned object has `{ type, execute, testEnvironment, models?, agentConfigurationDoc? }`
 *   - `type === "human"`, channel-neutral
 *   - Dispatches by `agent.adapterConfig.channel` to the registered Channel module
 *   - Hot-reloadable via Paperclip's `reloadExternalAdapter("human")`
 *
 * v0.1.0-pre: only the `gchat` channel is registered with real-soon code; other
 * channel modules throw "not implemented" until their respective phases land.
 */

import {
  registerChannel,
  getChannel,
  listChannels,
  gchatChannel,
  telegramChannel,
  slackChannel,
  whatsappChannel,
  emailChannel,
  type ChannelId,
  type AgentRef,
  type IssueContext,
} from "@d1dx/paperclip-human-bridge-shared";

export const ADAPTER_TYPE = "human" as const;

// Register every shipped channel module — gchat has real-soon code, the rest
// throw "not implemented" if used. Registration is idempotent across hot-reload
// because the registry is module-scoped and re-imported.
let initialized = false;
function ensureChannelsRegistered(): void {
  if (initialized) return;
  registerChannel(gchatChannel);
  registerChannel(telegramChannel);
  registerChannel(slackChannel);
  registerChannel(whatsappChannel);
  registerChannel(emailChannel);
  initialized = true;
}

export const agentConfigurationDoc = `# human agent configuration

Adapter: human — bridges Paperclip issues to a human via a configurable channel.

Required \`adapterConfig\` fields:

- \`channel\` (string): one of \`gchat\`, \`telegram\`, \`slack\`, \`whatsapp\`, \`email\`.
  Only \`gchat\` is implemented in v0.1.0. Other values are reserved.
- Channel-specific fields. For \`gchat\`:
  - \`gchatUserId\` (string, required): Google Chat user resource name (e.g. \`users/12345\`).
  - \`responderUrl\` (string, required): Public URL of the responder service.
  - \`language\` (string, default \`"en"\`): ISO language code.
  - \`timezone\` (string, IANA, default \`"UTC"\`).

When an issue is assigned to a \`human\`-typed agent, this adapter dispatches to
the registered channel module which sends a message to the human. The human's
reply is captured by the companion responder service, which posts back to
Paperclip REST authenticated as the agent.

See https://github.com/D1DX/paperclip-human-bridge for full architecture.
`;

interface PaperclipExecuteCtx {
  runId: string;
  agent: {
    id: string;
    name: string;
    role: string;
    adapterConfig: { channel?: ChannelId } & Record<string, unknown>;
  };
  context?: {
    issue?: Partial<IssueContext>;
    wakeReason?: string;
    bodyOverride?: string;
  } & Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface PaperclipExecuteResult {
  exitCode: 0 | 1;
  summary?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Channel-native message id for caller correlation. */
  externalId?: string;
}

/**
 * Map Paperclip's execute ctx into the channel's neutral send ctx.
 * Throws if required fields are missing (issue.id/title/body/status/url).
 */
export function mapExecuteCtxToChannelSend(ctx: PaperclipExecuteCtx) {
  const channelId = ctx.agent.adapterConfig.channel;
  if (!channelId) {
    throw new Error(
      `[paperclip-human] agent ${ctx.agent.id} has no \`channel\` set in adapterConfig. ` +
        `Known channels: ${listChannels().join(", ")}.`,
    );
  }

  const i = ctx.context?.issue ?? {};
  const required = ["id", "title", "body", "status", "url"] as const;
  for (const k of required) {
    if (typeof i[k] !== "string" || i[k] === "") {
      throw new Error(
        `[paperclip-human] execute ctx missing context.issue.${k} (got ${JSON.stringify(i[k])}).`,
      );
    }
  }
  const issue: IssueContext = {
    id: i.id as string,
    title: i.title as string,
    body: i.body as string,
    status: i.status as string,
    url: i.url as string,
    reporterName: i.reporterName,
  };

  // adapterConfig carries channel + per-channel fields. Strip the
  // discriminator before forwarding to keep the channel module free
  // of the registry's marker key.
  const { channel: _drop, ...channelConfig } = ctx.agent.adapterConfig;

  const agent: AgentRef = {
    id: ctx.agent.id,
    name: ctx.agent.name,
    role: ctx.agent.role,
    channel: channelId,
    channelConfig,
    apiKeyEnv: `PAPERCLIP_AGENT_${ctx.agent.id.toUpperCase().replace(/-/g, "_")}`,
  };

  return {
    channelId,
    sendCtx: {
      agent,
      issue,
      wakeReason: ctx.context?.wakeReason ?? "assigned",
      bodyOverride: ctx.context?.bodyOverride,
    },
  };
}

export function createServerAdapter() {
  ensureChannelsRegistered();

  return {
    type: ADAPTER_TYPE,

    async execute(ctx: PaperclipExecuteCtx): Promise<PaperclipExecuteResult> {
      try {
        const { channelId, sendCtx } = mapExecuteCtxToChannelSend(ctx);
        const channel = getChannel(channelId);
        const result = await channel.send(sendCtx);
        return {
          exitCode: 0,
          summary: result.summary,
          externalId: result.externalId,
        };
      } catch (e) {
        const err = e as Error;
        return {
          exitCode: 1,
          errorCode: err.name || "ExecuteError",
          errorMessage: err.message,
        };
      }
    },

    async testEnvironment(ctx: PaperclipExecuteCtx) {
      ensureChannelsRegistered();
      const channelId = ctx.agent.adapterConfig.channel;
      if (!channelId) {
        return {
          ok: false,
          message: `agent has no \`channel\` set. Known: ${listChannels().join(", ")}.`,
        };
      }
      try {
        // Resolution itself verifies the channel is registered.
        getChannel(channelId);
        return {
          ok: true,
          message: `Channel "${channelId}" is registered. Per-channel auth probe lands in v0.2.`,
        };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    },

    models: [],
    agentConfigurationDoc,
  };
}
