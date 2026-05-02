/**
 * @d1dx/paperclip-gchat-responder — Hono entry point for Node deployment.
 *
 * Receives Google Chat events at POST /event, verifies the Chat verification
 * token, looks up the assigned Paperclip agent for the sender, parses the
 * reply against the slash-command grammar, and calls Paperclip REST as the agent.
 *
 * v0.1 stub — endpoint exists, real handlers land in Phase 5.
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    status: "ok",
    package: "@d1dx/paperclip-gchat-responder",
    version: "0.1.0-pre",
    note: "scaffold — /event handler not yet implemented",
  }),
);

app.post("/event", async (c) => {
  // TODO Phase 5:
  //   1. verify X-Verification-Token
  //   2. resolve sender → agent (config.yaml)
  //   3. resolve active issue from DM thread state (SQLite)
  //   4. parse message against slash-command grammar
  //   5. call Paperclip REST as the agent
  //   6. reply with confirmation
  return c.json(
    {
      error: "Not implemented",
      message:
        "/event handler is a v0.1.0-pre scaffold. Track Phase 5 in https://github.com/D1DX/paperclip-gchat-bridge",
    },
    501,
  );
});

const port = Number(process.env.PORT ?? 8787);

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`paperclip-gchat-responder listening on :${port}`);
  serve({ fetch: app.fetch, port });
}

export default app;
