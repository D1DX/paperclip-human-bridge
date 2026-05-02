/**
 * Shared types used by the adapter and responder.
 *
 * v0.1 stubs — concrete shapes filled in during Phase 3.
 */

/** Paperclip agent reference. */
export interface AgentRef {
  /** Paperclip agent UUID. */
  id: string;
  /** Display name. */
  name: string;
  /** Paperclip role (ceo, cto, engineer, ...). */
  role: string;
  /** Google Chat user ID (e.g. "users/12345..."). */
  gchatUserId: string;
  /** Google Workspace email. */
  gchatEmail: string;
  /** Env var name holding this agent's Paperclip API key. */
  apiKeyEnv: string;
  /** ISO language code, e.g. "en", "he", "th". */
  language?: string;
  /** IANA timezone, e.g. "Asia/Bangkok". */
  timezone?: string;
}

/** Issue context passed from Paperclip → adapter `execute()` → DM body. */
export interface IssueContext {
  id: string;
  title: string;
  body: string;
  status: string;
  reporterName?: string;
  url: string;
}

/** Result of parsing a Chat reply against the slash-command grammar. */
export type CommandResult =
  | { kind: "comment"; body: string }
  | { kind: "done"; summary?: string }
  | { kind: "block"; reason: string }
  | { kind: "question"; body: string }
  | { kind: "help" }
  | { kind: "attachment"; body: string; attachmentRefs: string[] }
  | { kind: "unknown"; raw: string };
