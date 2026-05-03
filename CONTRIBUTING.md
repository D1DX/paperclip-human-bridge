# Contributing

Thanks for considering a contribution. This repo is in early scaffolding — most code is unwritten. The fastest way to help right now is to file issues for missing channel implementations, ambiguities in the architecture doc, or compatibility gaps with your Paperclip version.

## Dev setup

```bash
git clone https://github.com/D1DX/paperclip-human-bridge
cd paperclip-human-bridge
pnpm install
pnpm typecheck
pnpm test
```

Node 20+, pnpm 9.x.

## Project layout

```
packages/
  shared/                    — config schema, types, channel registry + interface, channel modules
    src/channels/gchat/      — first concrete channel (Google Chat)
    src/channels/telegram/   — placeholder
    src/channels/slack/      — placeholder
    src/channels/whatsapp/   — placeholder
    src/channels/email/      — placeholder
  adapter/                   — Paperclip plugin (createServerAdapter, type: "human")
  responder/                 — HTTP service for inbound channel events
examples/                    — config + .env templates, docker-compose
.github/
  workflows/                 — CI (typecheck + test + build on push/PR)
  ISSUE_TEMPLATE/
```

## Adding a channel

1. Implement the `Channel` interface (from `@d1dx/paperclip-human-bridge-shared/channels`):
   - `id` matching one of the literal `ChannelId` values (or propose a new one in a separate PR)
   - `displayName`
   - `send(ctx)` — outbound message
   - `parseInboundEvent(evt)` — verifies channel-native auth, returns neutral `ChannelInboundResult`
2. Define a typed `<Channel>AdapterConfig` interface for per-agent fields.
3. Add a zod schema variant in `packages/shared/src/config.ts`'s discriminated union.
4. Register the channel from `packages/adapter/src/index.ts`.
5. Add tests under `packages/shared/src/channels/<id>/__tests__/`.
6. Update the channel matrix in the root README.

## Coding style

- TypeScript strict mode.
- No runtime deps in `shared/` beyond zod and minimal essentials.
- Tests live next to the source (`foo.ts` + `foo.test.ts`).
- One small change per PR. Keep diffs focused.

## Commit messages

Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). Subject ≤72 chars.

## Filing issues

- **Bug:** include Paperclip version, Node version, channel, error messages, minimal repro.
- **Feature:** describe the use case before the design. Triage prefers proposals that fit existing patterns over net-new abstractions.
- **New channel:** open a tracking issue first; design discussion before code.
- **Compatibility:** if your Paperclip version doesn't load the plugin or rejects `adapterType: "human"`, attach `GET /api/adapters` output (redacted) and the loader logs.

## Releases

Conventional Commits drive changelog generation (TBD). Versioning: each package versioned independently. v0.x = breaking changes allowed between minor versions; v1.0+ = semver.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](./LICENSE). By contributing, you agree your contributions are licensed under MIT.
