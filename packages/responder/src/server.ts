/**
 * @d1dx/paperclip-human-responder — Hono entry point.
 *
 * Routes:
 *   GET  /health
 *   POST /event/:channel    — channel-tagged endpoint (gchat, telegram, ...)
 *   POST /event             — auto-detect channel from payload shape (best-effort)
 *
 * Verifies channel-native auth, looks up the assigned Paperclip agent for the
 * sender, parses the reply against the slash-command grammar, and calls
 * Paperclip REST as the agent.
 *
 * v0.1.0-pre: route shapes wired; concrete handlers land in Phase 5.
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
  registerChannel,
  getChannel,
  listChannels,
  isChannelRegistered,
  gchatChannel,
  telegramChannel,
  slackChannel,
  whatsappChannel,
  emailChannel,
  makePaperclipClient,
  type PaperclipClient,
} from "@d1dx/paperclip-human-bridge-shared";
import {
  buildAgentLookup,
  type AgentLookup,
  type AgentEntry,
} from "./agents/lookup.js";
import {
  InMemoryThreadStore,
  type ThreadStore,
} from "./state/thread-state.js";
import { dispatchInbound } from "./dispatch.js";

// Register every shipped channel module at module init so the responder can
// route inbound events to them. Symmetric with the adapter side. The shared
// registry throws on duplicate id, so guard for the case where module
// re-imports (test harnesses, hot reload) hit this twice.
for (const ch of [
  gchatChannel,
  telegramChannel,
  slackChannel,
  whatsappChannel,
  emailChannel,
]) {
  if (!isChannelRegistered(ch.id)) registerChannel(ch);
}

export interface CreateAppOptions {
  agents: AgentEntry[];
  paperclip: PaperclipClient;
  threads?: ThreadStore;
  agentLookup?: AgentLookup;
}

/**
 * Build a Hono app with explicit dependencies. Used by the production
 * bootstrap below (env-driven) and by tests (handcrafted deps).
 */
export function createApp(opts: CreateAppOptions) {
  const threads = opts.threads ?? new InMemoryThreadStore();
  const lookup = opts.agentLookup ?? buildAgentLookup({ agents: opts.agents });
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      package: "@d1dx/paperclip-human-responder",
      version: "0.1.0-pre",
      channels_registered: listChannels(),
      agents_registered: opts.agents.length,
    }),
  );

  app.post("/event/:channel", async (c) => {
    const channelId = c.req.param("channel");
    if (!isChannelRegistered(channelId)) {
      return c.json(
        {
          error: "unknown_channel",
          channel: channelId,
          known: listChannels(),
        },
        404,
      );
    }
    const channel = getChannel(channelId as Parameters<typeof getChannel>[0]);

    let inbound: Awaited<ReturnType<typeof channel.parseInboundEvent>>;
    try {
      inbound = await channel.parseInboundEvent({ request: c.req.raw });
    } catch (e) {
      // parseInboundEvent throws on auth failure — treat as 401.
      return c.json(
        { error: "auth_failed", message: (e as Error).message },
        401,
      );
    }

    const agent = await lookup.resolveBySender(channelId, inbound.senderExternalId);
    if (!agent) {
      const msg = `Sender ${inbound.senderExternalId} on channel ${channelId} is not a registered agent.`;
      try {
        await inbound.replyInChannel(msg);
      } catch {
        // best-effort reply; ignore
      }
      return c.json({ error: "unknown_sender", message: msg }, 403);
    }

    try {
      const result = await dispatchInbound({
        channel: channelId,
        inbound,
        agent,
        paperclip: opts.paperclip,
        threads,
      });
      return c.json({ ok: true, ...result });
    } catch (e) {
      const msg = (e as Error).message;
      try {
        await inbound.replyInChannel(`Internal error: ${msg}`);
      } catch {
        // best-effort; original error wins
      }
      return c.json({ error: "dispatch_failed", message: msg }, 500);
    }
  });

  app.post("/event", async (c) =>
    c.json(
      {
        error: "Not implemented",
        message:
          "Untagged /event auto-detect is v0.2 work. For v0.1 use /event/:channel (e.g. /event/gchat).",
      },
      501,
    ),
  );

  return app;
}

/**
 * Production bootstrap — config.yaml on disk + env-driven Paperclip URL +
 * in-memory thread store (replace with SQLite for multi-process /
 * persistence). Lazily evaluated so tests that import this module
 * (without env) don't crash.
 */
function bootstrapDefaults() {
  const baseUrl = process.env.PAPERCLIP_API_URL;
  if (!baseUrl) {
    throw new Error("PAPERCLIP_API_URL env var not set.");
  }
  // config.yaml parsing lands in Phase 5b — for now bootstrap with []
  // so the server can start in healthcheck-only mode while we wire up
  // production secrets.
  const agents: AgentEntry[] = [];
  const paperclip = makePaperclipClient({ baseUrl });
  return createApp({ agents, paperclip });
}

const port = Number(process.env.PORT ?? 8787);

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = bootstrapDefaults();
  console.log(`paperclip-human-responder listening on :${port}`);
  serve({ fetch: app.fetch, port });
}

// Default export retained for any consumer that imports the singleton.
// In production the entrypoint above wires the real app; this fallback
// is healthcheck-only with no agents.
export default createApp({
  agents: [],
  paperclip: makePaperclipClient({
    baseUrl: process.env.PAPERCLIP_API_URL ?? "http://localhost:0",
  }),
});
