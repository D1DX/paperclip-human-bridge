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
  listChannels,
  isChannelRegistered,
  gchatChannel,
  telegramChannel,
  slackChannel,
  whatsappChannel,
  emailChannel,
} from "@d1dx/paperclip-human-bridge-shared";

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

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    status: "ok",
    package: "@d1dx/paperclip-human-responder",
    version: "0.1.0-pre",
    channels_registered: listChannels(),
    note: "scaffold — /event handlers not yet implemented",
  }),
);

app.post("/event/:channel", async (c) => {
  const channel = c.req.param("channel");
  // TODO Phase 5:
  //   1. assert channel is registered + has an inbound parser
  //   2. call channel.parseInboundEvent(req) — verifies channel-native auth
  //   3. resolve sender → agent (config.yaml)
  //   4. resolve active issue from DM thread state (SQLite)
  //   5. parse against slash-command grammar
  //   6. call Paperclip REST as the agent
  //   7. reply via channel.replyInChannel(...)
  return c.json(
    {
      error: "Not implemented",
      channel,
      message:
        "/event/:channel handler is a v0.1.0-pre scaffold. Track Phase 5 in https://github.com/D1DX/paperclip-human-bridge",
    },
    501,
  );
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

const port = Number(process.env.PORT ?? 8787);

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`paperclip-human-responder listening on :${port}`);
  serve({ fetch: app.fetch, port });
}

export default app;
