/**
 * @d1dx/paperclip-human-bridge-shared
 *
 * Shared library used by both the Paperclip plugin (`@d1dx/paperclip-human-adapter`)
 * and the responder service (`@d1dx/paperclip-human-responder`).
 *
 * Re-exports config schema, types, channel registry + interface, channel modules.
 * Concrete Chat / Paperclip API clients land in Phase 3.
 */

export * from "./config.js";
export * from "./types.js";
export * from "./commands.js";
export * from "./channels/registry.js";

// Re-export each channel module under a namespace so consumers can import
// individual channels (e.g. `import { gchatChannel } from "@d1dx/paperclip-human-bridge-shared"`).
export { gchatChannel } from "./channels/gchat/index.js";
export { telegramChannel } from "./channels/telegram/index.js";
export { slackChannel } from "./channels/slack/index.js";
export { whatsappChannel } from "./channels/whatsapp/index.js";
export { emailChannel } from "./channels/email/index.js";
