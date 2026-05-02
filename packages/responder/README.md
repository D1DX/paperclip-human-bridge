# @d1dx/paperclip-gchat-responder

HTTP service that receives Google Chat events when a human replies in their Paperclip-bot DM, then posts back to Paperclip REST authenticated as the assigned agent.

> **Status:** scaffold (v0.1.0-pre). `/event` handler is a stub.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness probe |
| `POST` | `/event` | Google Chat event receiver |

## Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `PAPERCLIP_API_URL` | yes | Paperclip base URL (e.g. `https://paperclip.example.com`) |
| `GCHAT_VERIFICATION_TOKEN` | yes | Token Google sends on every Chat event for auth |
| `GCHAT_SERVICE_ACCOUNT_JSON` | yes | Service account JSON for fetching profiles + attachments |
| `BRIDGE_CONFIG_PATH` | yes | Path to `config.yaml` |
| `BRIDGE_DB_PATH` | yes | SQLite path for DM thread state |
| `PAPERCLIP_AGENT_KEY_*` | yes | Per-agent API keys, one env var per agent (referenced by `agents[].api_key_env` in `config.yaml`) |
| `PORT` | no | HTTP port (default `8787`) |

## Deploy targets

- **Docker** (this directory's `Dockerfile`)
- **Cloudflare Worker** (`packages/responder/src/worker.ts` — coming in Phase 5)
- **Bare Node** (`pnpm start` after `pnpm build`)

## Auth model

Per agent, not per board. Each Paperclip human agent has its own `agent_api_keys` row; the responder selects the right key based on the resolved Chat sender. Leak blast radius = one agent's surface, not the whole company.

## License

MIT.
