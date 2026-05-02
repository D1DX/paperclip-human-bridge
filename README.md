# paperclip-gchat-bridge

Paperclip ↔ Google Chat human-agent bridge. A first-class `gchat` adapter plugin for [Paperclip](https://github.com/paperclipai/paperclip) plus a companion responder service that lets you assign Paperclip issues to humans via Google Chat direct messages and capture their replies as comments, work-products, status changes, and interaction responses.

> **Status:** Early scaffold. Not production-ready. v0.1.0 release tracked at [milestones](https://github.com/D1DX/paperclip-gchat-bridge/milestones).

## Why

Paperclip ships first-class adapters for AI runtimes — `claude_local`, `codex_local`, `openclaw_gateway`, `cursor`, `gemini_local`, and others — plus a generic `http` adapter. There is no native human adapter. Issues assigned to humans either land in the web UI (which the human must remember to check) or require every adopter to rebuild the same bridge.

This repo ships the human path as a first-class Paperclip plugin so any Paperclip + Google Workspace org can put humans on the org chart with native UI integration, per-agent API keys, and a clear slash-command grammar.

## Architecture

```
Paperclip (your host)                            Google Chat (your Workspace)
┌──────────────────────────────┐                 ┌─────────────────────────┐
│  adapter-plugins/             │                 │  Person's DM thread      │
│   @d1dx/paperclip-gchat-      │  1. assigned   │   ┌──────────────────┐   │
│   adapter                     │  ────────────► │   │ Paperclip bot:   │   │
│   ┌─────────────────────┐    │  send DM via   │   │ Issue PT-1234... │   │
│   │ createServerAdapter()│    │  Chat API      │   └──────────────────┘   │
│   │ type: "gchat"        │    │                 │            │            │
│   │ execute(ctx) ────────┼────┼────────────────►            ▼            │
│   └─────────────────────┘    │                 │   ┌──────────────────┐   │
└──────────────┬───────────────┘                 │   │ Person reply     │   │
               │                                 │   │ "/done shipped"  │   │
               │ 5. responder calls              │   └──────────────────┘   │
               │   Paperclip REST as agent       └────────────┬────────────┘
               │                                              │
               ▼                                              │ 4. Chat event
┌──────────────────────────────────────────────────┐         │
│  @d1dx/paperclip-gchat-responder                  │ ◄───────┘
│  Hono service or Cloudflare Worker                 │
│  ┌─────────────────────────────────────────────┐  │
│  │ POST /event                                  │  │
│  │  - verify Chat verification token            │  │
│  │  - identify sender → look up agent           │  │
│  │  - resolve active issue from DM thread state │  │
│  │  - parse: text / /done / /block / /q / file  │  │
│  │  - call Paperclip REST as the agent          │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

Full architecture, message flows, auth model, and failure modes: [`docs/architecture.md`](./docs/architecture.md) (coming soon — see source repo `platforms/paperclip/docs/gchat-bridge.md` for the canonical version under construction).

## Packages

| Package | Purpose | Runtime |
|---------|---------|---------|
| [`@d1dx/paperclip-gchat-adapter`](./packages/adapter) | Paperclip plugin. `execute()` sends DMs via Google Chat API. Loads into Paperclip's `adapter-plugins/`. | Inside Paperclip (Node 20) |
| [`@d1dx/paperclip-gchat-responder`](./packages/responder) | HTTP service. Receives Google Chat events, calls Paperclip REST as the assigned agent. | Standalone (Node 20 / Bun / Cloudflare Worker / Docker) |
| [`@d1dx/paperclip-gchat-bridge-shared`](./packages/shared) | Config schema, types, Chat + Paperclip API clients, slash-command parser. | Library |

## Slash command grammar (v1)

| Reply in Chat DM | Effect in Paperclip |
|------------------|---------------------|
| Free text | Posted as a comment on the active issue |
| `/done [summary]` | Submits a work-product + marks status `done` |
| `/block <reason>` | Marks status `blocked` + posts reason as comment |
| `/q <question>` | Opens a question interaction, escalates to whoever assigned the issue |
| `/help` | Replies with this grammar |
| Free text + attachment | Uploads attachment as work-product with the text as title |

## Quickstart

> **Coming soon.** Bootstrap will be: install adapter into Paperclip's plugin store, deploy responder, configure Google Chat app, register agents, smoke test.

For now see the [task folder](https://github.com/D1DX/paperclip-gchat-bridge/issues) for current milestones.

## Status

| Phase | Status |
|-------|--------|
| 1. Doc + scaffold | ✅ in progress |
| 2. Repo scaffold | ✅ this commit |
| 3. Shared package | ⏳ next |
| 4. Adapter package | ⏳ |
| 5. Responder package | ⏳ |
| 6. Google Chat app provisioning | ⏳ |
| 7. Plugin install path validated | ⏳ |
| 8. Per-agent records | ⏳ |
| 9. Deploy | ⏳ |
| 10. Smoke test | ⏳ |
| 11. v0.1.0 release | ⏳ |
| 12. Doc freeze | ⏳ |

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgements

- [Paperclip](https://github.com/paperclipai/paperclip) — the orchestration platform this plugs into
- [Hermes adapter](https://github.com/NousResearch/hermes-paperclip-adapter) — community adapter reference
- Built by [D1DX](https://d1dx.com), an operations automation studio
