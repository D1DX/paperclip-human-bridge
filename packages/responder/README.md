# @d1dx/paperclip-human-responder

HTTP service that receives channel events when a human replies in their Paperclip-bot conversation, then posts back to Paperclip REST authenticated as the assigned agent.

> **Status:** scaffold (v0.1.0-pre). `/event/:channel` route shape wired; handlers are stubs.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness probe (also reports registered channels) |
| `POST` | `/event/:channel` | Channel-tagged event receiver (`gchat`, `telegram`, ...) |
| `POST` | `/event` | Auto-detect channel from payload (v0.2 — returns 501 today) |

## Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `PAPERCLIP_API_URL` | yes | Paperclip base URL (e.g. `https://paperclip.example.com`) |
| `BRIDGE_CONFIG_PATH` | yes | Path to `config.yaml` |
| `BRIDGE_DB_PATH` | yes | SQLite path for thread-state |
| `GCHAT_AUDIENCE` | for gchat agents | Expected `aud` claim of inbound OIDC JWTs (responder URL or bot project number) |
| `GCHAT_SERVICE_ACCOUNT_JSON` | for gchat agents | Service account JSON for fetching profiles + attachments |
| `PAPERCLIP_AGENT_KEY_*` | yes | Per-agent API keys, one env var per agent |
| `PORT` | no | HTTP port (default `8787`) |

Each channel module documents its own auth env. A responder hosting only `gchat` agents only needs the `GCHAT_*` vars.

## Deploy targets

- **Docker** (this directory's `Dockerfile`)
- **Cloudflare Worker** (entry point coming in Phase 5)
- **Bare Node** (`pnpm start` after `pnpm build`)

## Auth model

Per agent, not per board. Each Paperclip human agent has its own `agent_api_keys` row; the responder selects the right key based on the resolved channel sender. Leak blast radius = one agent's surface, not the whole company.

## License

MIT.
