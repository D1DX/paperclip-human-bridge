/**
 * Shared types used by the adapter and responder.
 */

export type ChannelId = "gchat" | "telegram" | "slack" | "whatsapp" | "email";

/** Generic Paperclip agent reference (channel-neutral fields). */
export interface AgentRef {
  /** Paperclip agent UUID. */
  id: string;
  /** Display name. */
  name: string;
  /** Paperclip role (ceo, cto, engineer, ...). */
  role: string;
  /** Selected channel for this agent. */
  channel: ChannelId;
  /** Channel-specific config (validated per-channel by zod discriminated union). */
  channelConfig: Record<string, unknown>;
  /** Env var name holding this agent's Paperclip API key. */
  apiKeyEnv: string;
  /** ISO language code, e.g. "en", "he", "th". */
  language?: string;
  /** IANA timezone, e.g. "Asia/Bangkok". */
  timezone?: string;
}

/** Issue context passed from Paperclip → adapter `execute()` → channel `send()`. */
export interface IssueContext {
  id: string;
  title: string;
  body: string;
  status: string;
  reporterName?: string;
  url: string;
}

/** Result of parsing a channel reply against the slash-command grammar. */
export type CommandResult =
  | { kind: "comment"; body: string }
  | { kind: "done"; summary?: string }
  | { kind: "block"; reason: string }
  | { kind: "question"; body: string }
  | { kind: "help" }
  | { kind: "attachment"; body: string; attachmentRefs: string[] }
  | { kind: "unknown"; raw: string };
