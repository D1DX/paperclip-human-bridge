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
  context?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export function createServerAdapter() {
  ensureChannelsRegistered();

  return {
    type: ADAPTER_TYPE,

    async execute(ctx: PaperclipExecuteCtx) {
      const channelId = ctx.agent.adapterConfig.channel;
      if (!channelId) {
        throw new Error(
          `[paperclip-human] agent ${ctx.agent.id} has no \`channel\` set in adapterConfig. ` +
            `Known channels: ${listChannels().join(", ")}.`,
        );
      }
      const channel = getChannel(channelId);
      // v0.1.0-pre: channel.send() throws on every channel until Phase 3 lands gchat.
      // Adapter dispatch path itself is fully wired and tested.
      throw new Error(
        `[paperclip-human v0.1.0-pre] dispatch wired but channel "${channel.id}" send() not implemented yet. ` +
          `Track Phase 3 in https://github.com/D1DX/paperclip-human-bridge`,
      );
    },

    async testEnvironment(_ctx: PaperclipExecuteCtx) {
      ensureChannelsRegistered();
      return {
        ok: false,
        message: `testEnvironment() not implemented yet (v0.1.0-pre). Registered channels: ${listChannels().join(", ")}.`,
      };
    },

    models: [],
    agentConfigurationDoc,
  };
}
