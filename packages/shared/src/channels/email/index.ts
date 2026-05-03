/**
 * Email channel — placeholder.
 *
 * Not implemented in v0.1.0. Follow the `gchat` module pattern when
 * adding a real implementation: provide a `Channel` object with
 * `send()` and `parseInboundEvent()`, plus a typed adapterConfig
 * subtype, and register from `packages/adapter/src/index.ts`.
 */

import type { Channel } from "../registry.js";

export const emailChannel: Channel = {
  id: "email",
  displayName: "Email",

  async send(_ctx) {
    throw new Error(
      "[paperclip-human email] channel not implemented. Track: https://github.com/D1DX/paperclip-human-bridge/issues",
    );
  },

  async parseInboundEvent(_evt) {
    throw new Error(
      "[paperclip-human email] channel not implemented. Track: https://github.com/D1DX/paperclip-human-bridge/issues",
    );
  },
};
