/**
 * Google Chat channel — first concrete `Channel` implementation.
 *
 * This module exports two things:
 *   - `gchatChannel`: the default lazy-init `Channel` that reads its
 *     deps from process env at first use. Both adapter and responder
 *     `registerChannel(gchatChannel)` at module init; deps load on first
 *     send/parse call so apps can fail-fast at registration without
 *     yet having credentials in env.
 *   - `makeGchatChannel({serviceAccount, verificationToken})`: an
 *     explicit-deps factory for tests and Worker deployments where env
 *     reading is wrong (Worker secrets ≠ process.env).
 *
 * Env vars (default lazy-init path):
 *   - GCHAT_SERVICE_ACCOUNT_JSON — full service account JSON, raw or
 *     `op://` reference rendered by `op inject`.
 *   - GCHAT_VERIFICATION_TOKEN   — Chat-app verification token.
 *
 * Outbound: send() renders a header + issue context + body, calls
 * sendDmMessage. Inbound: parseInboundEvent() delegates to the parser
 * factory.
 */
import type { Channel } from "../registry.js";
import {
  sendDmMessage,
  type ServiceAccountKey,
} from "./client.js";
import { makeGchatParser } from "./parser.js";

export interface GchatChannelDeps {
  serviceAccount: ServiceAccountKey;
  verificationToken: string;
}

/** Default lazy env reader — used by the singleton `gchatChannel`. */
function loadDepsFromEnv(): GchatChannelDeps {
  const saRaw = process.env.GCHAT_SERVICE_ACCOUNT_JSON;
  const vtok = process.env.GCHAT_VERIFICATION_TOKEN;
  if (!saRaw) {
    throw new Error(
      "[gchat channel] GCHAT_SERVICE_ACCOUNT_JSON env var not set.",
    );
  }
  if (!vtok) {
    throw new Error(
      "[gchat channel] GCHAT_VERIFICATION_TOKEN env var not set.",
    );
  }
  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = JSON.parse(saRaw);
  } catch (e) {
    throw new Error(
      `[gchat channel] GCHAT_SERVICE_ACCOUNT_JSON is not valid JSON: ${(e as Error).message}`,
    );
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error(
      "[gchat channel] service account JSON missing client_email or private_key.",
    );
  }
  return { serviceAccount, verificationToken: vtok };
}

/**
 * Render the outbound message body. Format is intentionally simple
 * markdown that Chat will display verbatim — no cards in v0.1.
 */
export function renderIssueMessage(ctx: {
  issue: { id: string; title: string; body: string; status: string; url: string };
  wakeReason: string;
  bodyOverride?: string;
}): string {
  if (ctx.bodyOverride) return ctx.bodyOverride;
  const lines = [
    `*[Paperclip] Issue ${ctx.issue.id}*: ${ctx.issue.title}`,
    `Status: ${ctx.issue.status} · Reason: ${ctx.wakeReason}`,
    `Link: ${ctx.issue.url}`,
    "",
    ctx.issue.body,
    "",
    "_Reply with a comment, `/done [summary]`, `/block <reason>`, `/q <question>`, or `/help`._",
  ];
  return lines.join("\n");
}

/**
 * Build an explicit-deps channel — preferred for tests and any
 * deployment that doesn't use Node `process.env` (e.g. Workers).
 */
export function makeGchatChannel(deps: GchatChannelDeps): Channel {
  const parseInboundEvent = makeGchatParser(deps);
  return {
    id: "gchat",
    displayName: "Google Chat",

    async send(ctx) {
      // The agent's gchat config carries the user's Chat space resource
      // name. v0.1 stores this on `agent.channelConfig.gchatUserSpace`
      // (Chat returns `spaces/{id}` from a prior message — the responder
      // caches it per-agent). For the first-ever send to a user the
      // adapter resolves the space via Chat REST (`spaces.findDirectMessage`)
      // — that lookup lands in Phase 4 alongside `execute()`.
      const cc = ctx.agent.channelConfig as {
        gchatUserSpace?: string;
      };
      if (!cc.gchatUserSpace) {
        throw new Error(
          `[gchat channel] agent ${ctx.agent.id} channelConfig.gchatUserSpace not set — Phase 4 will resolve via spaces.findDirectMessage from gchatUserId.`,
        );
      }
      const text = renderIssueMessage(ctx);
      const sent = await sendDmMessage(
        deps.serviceAccount,
        cc.gchatUserSpace,
        text,
        ctx.issue.id,
      );
      return {
        externalId: sent.messageName,
        summary: `Sent DM to ${ctx.agent.name} (${sent.threadName})`,
      };
    },

    parseInboundEvent,
  };
}

/**
 * Default singleton. Lazy-loads env on first send/parseInboundEvent so
 * registerChannel(gchatChannel) at module init can't crash apps that
 * are still wiring up secrets.
 */
let cachedChannel: Channel | null = null;
function getOrInitDefault(): Channel {
  if (!cachedChannel) cachedChannel = makeGchatChannel(loadDepsFromEnv());
  return cachedChannel;
}

export const gchatChannel: Channel = {
  id: "gchat",
  displayName: "Google Chat",
  async send(ctx) {
    return getOrInitDefault().send(ctx);
  },
  async parseInboundEvent(evt) {
    return getOrInitDefault().parseInboundEvent(evt);
  },
};

export interface GchatAdapterConfig {
  channel: "gchat";
  /** Google Chat user resource name (e.g. `users/12345...`). Used by Phase 4 to resolve the DM space. */
  gchatUserId: string;
  /** Pre-resolved DM space resource name (e.g. `spaces/AAA`). Optional — adapter resolves from gchatUserId on first send if missing. */
  gchatUserSpace?: string;
  /** Public URL of the responder service handling this channel. */
  responderUrl: string;
  language?: string;
  timezone?: string;
}
