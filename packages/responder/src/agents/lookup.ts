/**
 * Agent lookup — sender external id (channel-native) → Paperclip agent + API key.
 *
 * Source of truth in v0.1 is `config.yaml` (decisions.md row 12):
 *
 *   agents:
 *     - id: agent-uuid-1
 *       name: Daniel
 *       channel: gchat
 *       channelConfig:
 *         gchatUserId: users/12345
 *         gchatUserSpace: spaces/AAA
 *       apiKeyEnv: PAPERCLIP_AGENT_DANIEL
 *
 * Production resolves apiKey via process.env[entry.apiKeyEnv]. Tests
 * inject a `keyResolver` to bypass env.
 */

export interface AgentEntry {
  id: string;
  name: string;
  role?: string;
  channel: string;
  channelConfig: Record<string, unknown>;
  apiKeyEnv: string;
}

export interface ResolvedAgent {
  entry: AgentEntry;
  apiKey: string;
}

export interface AgentLookup {
  /** Find the agent who owns a given channel-native sender id. */
  resolveBySender(channel: string, senderExternalId: string): Promise<ResolvedAgent | null>;
}

export interface BuildAgentLookupOptions {
  agents: AgentEntry[];
  /** Defaults to reading process.env. */
  keyResolver?: (envName: string) => string | undefined;
}

export function buildAgentLookup(opts: BuildAgentLookupOptions): AgentLookup {
  const keyResolver = opts.keyResolver ?? ((name) => process.env[name]);

  // Index by (channel, channel-native id) — channel decides which field on
  // channelConfig is the lookup key.
  const idx = new Map<string, AgentEntry>();
  for (const a of opts.agents) {
    const native = nativeIdFor(a);
    if (!native) continue;
    idx.set(`${a.channel}::${native}`, a);
  }

  return {
    async resolveBySender(channel, senderExternalId) {
      const entry = idx.get(`${channel}::${senderExternalId}`);
      if (!entry) return null;
      const apiKey = keyResolver(entry.apiKeyEnv);
      if (!apiKey) {
        throw new Error(
          `[agent-lookup] agent ${entry.id} apiKeyEnv ${entry.apiKeyEnv} not set in environment.`,
        );
      }
      return { entry, apiKey };
    },
  };
}

/**
 * Channel-specific extractor for the native sender id stored on the agent.
 * For gchat that's `users/{id}`; for telegram it'd be the chat id; etc.
 */
function nativeIdFor(a: AgentEntry): string | undefined {
  switch (a.channel) {
    case "gchat":
      return (a.channelConfig as { gchatUserId?: string }).gchatUserId;
    case "telegram":
      return (a.channelConfig as { telegramChatId?: string }).telegramChatId;
    case "slack":
      return (a.channelConfig as { slackUserId?: string }).slackUserId;
    case "whatsapp":
      return (a.channelConfig as { whatsappPhoneE164?: string }).whatsappPhoneE164;
    case "email":
      return (a.channelConfig as { emailAddress?: string }).emailAddress;
    default:
      return undefined;
  }
}
