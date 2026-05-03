/**
 * Channel-neutral slash-command parser.
 *
 * Grammar (v1, per `platforms/paperclip/docs/human-bridge.md` §392):
 *
 *   <free text>             → { kind: "comment",   body }
 *   /done                   → { kind: "done" }
 *   /done <summary>         → { kind: "done", summary }
 *   /block <reason>         → { kind: "block",    reason }
 *   /q <question>           → { kind: "question", body }
 *   /help                   → { kind: "help" }
 *   <text> + attachments    → { kind: "attachment", body, attachmentRefs }
 *   /done + attachments     → still { kind: "done" } (attachments forwarded
 *                             separately by the responder when uploading
 *                             the work-product) — body becomes the summary
 *
 * Channels normalize their native message into `{ text, attachmentRefs }`
 * and call this parser. Returns a discriminated union from `types.ts`
 * which the responder turns into Paperclip REST calls.
 */
import type { CommandResult } from "./types.js";

const SLASH = /^\s*\/([a-zA-Z]+)(?:\s+([\s\S]*))?$/;

export interface ParseInput {
  /** Raw message text from the channel. */
  text: string;
  /** Channel-native attachment refs (resource names, URLs, etc.). */
  attachmentRefs?: string[];
}

export function parseCommand(input: ParseInput): CommandResult {
  const text = (input.text ?? "").trim();
  const attachments = input.attachmentRefs ?? [];
  const m = text.match(SLASH);

  // Slash command path
  if (m) {
    // group 1 is mandatory in the regex; group 2 is optional.
    const cmd = (m[1] ?? "").toLowerCase();
    const rest = (m[2] ?? "").trim();
    switch (cmd) {
      case "done":
        // Attachments + /done collapse into "done with summary = rest".
        // The responder uploads the attachments to the work-product.
        return rest ? { kind: "done", summary: rest } : { kind: "done" };
      case "block":
        if (!rest) {
          return {
            kind: "unknown",
            raw: text,
          };
        }
        return { kind: "block", reason: rest };
      case "q":
      case "question":
        if (!rest) {
          return { kind: "unknown", raw: text };
        }
        return { kind: "question", body: rest };
      case "help":
        return { kind: "help" };
      default:
        return { kind: "unknown", raw: text };
    }
  }

  // Non-slash path
  if (attachments.length > 0) {
    return { kind: "attachment", body: text, attachmentRefs: attachments };
  }
  if (text.length === 0) {
    // Empty text + no attachments — nothing to do.
    return { kind: "unknown", raw: "" };
  }
  return { kind: "comment", body: text };
}

/**
 * Help text rendered when a user sends `/help`. Channels send this back
 * verbatim. Kept here so all channels share the same grammar reference.
 */
export const HELP_TEXT = [
  "*Paperclip human-bridge commands*",
  "",
  "  <free text>       → comment on the active issue",
  "  /done [summary]   → mark issue done (creates a work-product)",
  "  /block <reason>   → mark issue blocked (with reason as comment)",
  "  /q <question>     → ask the assigner a question",
  "  /help             → show this message",
  "  <text> + file     → upload as work-product",
].join("\n");
