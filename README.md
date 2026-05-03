# paperclip-human-bridge

Native [Paperclip](https://github.com/paperclipai/paperclip) `human` adapter plugin + companion responder service. Lets you assign Paperclip issues to humans via their preferred channel — Google Chat in v0.1, with Telegram, Slack, WhatsApp, and email as planned channel modules behind the same channel registry.

> **Status:** Early scaffold. Not production-ready. v0.1.0 release tracked at [milestones](https://github.com/D1DX/paperclip-human-bridge/milestones).

## Why

Paperclip ships first-class adapters for AI runtimes — `claude_local`, `codex_local`, `openclaw_gateway`, `cursor`, `gemini_local`, and others — plus a generic `http` adapter. There is no native human adapter. Issues assigned to humans either land in the web UI (which the human must remember to check) or require every adopter to rebuild the same bridge.

This repo ships the human path as a first-class Paperclip plugin with a pluggable channel layer so any Paperclip + (Google Workspace / Telegram / Slack / ...) deployment can put humans on the org chart with native UI integration, per-agent API keys, and a clear slash-command grammar.

## Adapter type

```ts
{
  adapterType: "human",
  adapterConfig: {
    channel: "gchat" | "telegram" | "slack" | "whatsapp" | "email",
    // ...channel-specific fields
  }
}
```

The adapter dispatches by `channel`. Each channel module owns its own outbound send + inbound parse. Unimplemented channels throw a clear "not implemented" error rather than silently dropping messages.

## Channel matrix (v0.1)

| Channel | Outbound | Inbound | Status |
|---------|----------|---------|--------|
| Google Chat (`gchat`) | DM via Chat API | Chat events to responder | 🟡 Phase 3 (real-soon) |
| Telegram (`telegram`) | — | — | ⏳ planned |
| Slack (`slack`) | — | — | ⏳ planned |
| WhatsApp (`whatsapp`) | — | — | ⏳ planned |
| Email (`email`) | — | — | ⏳ planned |

Adding a channel: implement `Channel` interface from `@d1dx/paperclip-human-bridge-shared/channels` (`send` + `parseInboundEvent`), register in the adapter, add the config-schema variant. Reference: `packages/shared/src/channels/gchat/`.

## Architecture

```
Paperclip (your host)                              Channel (your Workspace / network)
┌──────────────────────────────────────┐           ┌────────────────────────────────┐
│  adapter-plugins/                     │           │  Person's DM / channel thread  │
│   @d1dx/paperclip-human-adapter      │  1. issue │   ┌──────────────────────┐      │
│                                       │  assigned │   │ "PT-1234: Add logout"│      │
│  ┌──────────────────────────────┐    │  ────────►│   │ /done /block /q ...  │      │
│  │ createServerAdapter()         │    │   send via│   └──────────────────────┘      │
│  │   type: "human"               │    │   channel │            │                    │
│  │   execute(ctx) → channel.send │    │   module  │            ▼                    │
│  │   getChannel(adapterConfig    │    │           │   ┌──────────────────────┐      │
│  │     .channel)                 │    │           │   │ Person reply         │      │
│  └──────────────────────────────┘    │           │   │ "/done shipped"      │      │
└────────────┬─────────────────────────┘           │   └──────────────────────┘      │
             │                                     └────────────┬───────────────────┘
             │ 5. responder calls Paperclip REST                │
             │   AS the assigned agent                          │ 4. event POST
             │                                                  │
             ▼                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│  @d1dx/paperclip-human-responder                                                │
│   POST /event/:channel                                                          │
│    - channel.parseInboundEvent(req)  (verifies channel-native auth)             │
│    - resolve sender → agent (config.yaml)                                       │
│    - resolve active issue from thread state (SQLite)                            │
│    - parse: text / /done / /block / /q / attachment                             │
│    - call Paperclip REST as the agent                                           │
│    - reply via channel.replyInChannel()                                         │
└────────────────────────────────────────────────────────────────────────────────┘
```

Full architecture, message flows, auth model, and failure modes: [`docs/architecture.md`](./docs/architecture.md) (TBD — see source repo `platforms/paperclip/docs/human-bridge.md` for the canonical version under construction).

## Packages

| Package | Purpose | Runtime |
|---------|---------|---------|
| [`@d1dx/paperclip-human-adapter`](./packages/adapter) | Paperclip plugin. `execute()` dispatches to a channel module's `send()`. Loads into Paperclip's `adapter-plugins/`. | Inside Paperclip (Node 20) |
| [`@d1dx/paperclip-human-responder`](./packages/responder) | HTTP service. Receives channel events at `/event/:channel`, calls Paperclip REST as the assigned agent. | Standalone (Node 20 / Bun / Cloudflare Worker / Docker) |
| [`@d1dx/paperclip-human-bridge-shared`](./packages/shared) | Config schema (zod discriminated union by `channel`), types, channel registry + interface, channel modules. | Library |

## Slash command grammar (v1)

| Reply in channel | Effect in Paperclip |
|------------------|---------------------|
| Free text | Posted as a comment on the active issue |
| `/done [summary]` | Submits a work-product + marks status `done` |
| `/block <reason>` | Marks status `blocked` + posts reason as comment |
| `/q <question>` | Opens a question interaction, escalates upstream |
| `/help` | Replies with this grammar |
| Free text + attachment | Uploads attachment as work-product with the text as title |

Grammar is channel-neutral. Channel modules are responsible for normalizing their native message shape into the same parser input.

## Quickstart

> **Coming soon.** Bootstrap will be: install adapter into Paperclip's plugin store, deploy responder, configure your channel of choice (Chat app / Telegram bot / Slack app / ...), register agents, smoke test.

For now see the [task tracker](https://github.com/D1DX/paperclip-human-bridge/issues) for current milestones.

## Status

| Phase | Status |
|-------|--------|
| 1. Doc-first foundation | ✅ done |
| 2. Repo scaffold (channel-pluggable) | ✅ this commit |
| 3. Shared package (gchat client + parser) | ⏳ next |
| 4. Adapter package (real `send` dispatch) | ⏳ |
| 5. Responder package (real `/event/:channel` handlers) | ⏳ |
| 6. Google Chat app provisioning | ⏳ |
| 7. Plugin install path validated | ⏳ |
| 8. Per-agent records | ⏳ |
| 9. Deploy | ⏳ |
| 10. Smoke test | ⏳ |
| 11. v0.1.0 release | ⏳ |
| 12. Doc freeze | ⏳ |
| Future: Telegram channel | ⏳ |
| Future: Slack channel | ⏳ |
| Future: WhatsApp channel | ⏳ |
| Future: Email channel | ⏳ |

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgements

- [Paperclip](https://github.com/paperclipai/paperclip) — the orchestration platform this plugs into
- [Hermes adapter](https://github.com/NousResearch/hermes-paperclip-adapter) — community adapter reference
- Built by [D1DX](https://d1dx.com), an operations automation studio
