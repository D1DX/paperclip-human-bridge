# Contributing

Thanks for considering a contribution. This repo is in early scaffolding — most code is unwritten. The fastest way to help right now is to file issues for missing features, ambiguities in the architecture doc, or compatibility gaps with your Paperclip version.

## Dev setup

```bash
git clone https://github.com/D1DX/paperclip-gchat-bridge
cd paperclip-gchat-bridge
pnpm install
pnpm typecheck
pnpm test
```

Node 20+, pnpm 9.x.

## Project layout

```
packages/
  shared/     — config schema, types, Chat + Paperclip API clients, command parser
  adapter/    — Paperclip plugin (createServerAdapter)
  responder/  — HTTP service for inbound Chat events
examples/     — config templates, docker-compose, wrangler.toml
.github/
  workflows/  — CI (typecheck + test + build on push/PR)
  ISSUE_TEMPLATE/
```

## Coding style

- TypeScript strict mode.
- No runtime deps in `shared/` beyond zod and minimal essentials.
- Tests live next to the source (`foo.ts` + `foo.test.ts`).
- One small change per PR. Keep diffs focused.

## Commit messages

Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). Subject ≤72 chars.

## Filing issues

- **Bug:** include Paperclip version, Node version, error messages, minimal repro.
- **Feature:** describe the use case before the design. Triage prefers proposals that fit existing patterns over net-new abstractions.
- **Compatibility:** if your Paperclip version doesn't load the plugin or rejects `adapterType: "gchat"`, attach `GET /api/adapters` output (redacted) and the loader logs.

## Releases

Conventional Commits drive changelog generation (TBD). Versioning: each package versioned independently. v0.x = breaking changes allowed between minor versions; v1.0+ = semver.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](./LICENSE). By contributing, you agree your contributions are licensed under MIT.
