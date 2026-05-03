/**
 * Google Chat channel — first concrete `Channel` implementation.
 *
 * v0.1.0-pre stub: send() and parseInboundEvent() throw. Real Chat API
 * client + event parsing land in Phase 3.
 */

import type { Channel } from "../registry.js";

export const gchatChannel: Channel = {
  id: "gchat",
  displayName: "Google Chat",

  async send(_ctx) {
    throw new Error(
      "[paperclip-human gchat] send() not implemented yet (v0.1.0-pre). Phase 3.",
    );
  },

  async parseInboundEvent(_evt) {
    throw new Error(
      "[paperclip-human gchat] parseInboundEvent() not implemented yet (v0.1.0-pre). Phase 3.",
    );
  },
};

export interface GchatAdapterConfig {
  channel: "gchat";
  /** Google Chat user resource name (e.g. `users/12345...`). */
  gchatUserId: string;
  /** Public URL of the responder service handling this channel. */
  responderUrl: string;
  language?: string;
  timezone?: string;
}
