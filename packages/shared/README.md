# @d1dx/paperclip-gchat-bridge-shared

Shared library for the [paperclip-gchat-bridge](https://github.com/D1DX/paperclip-gchat-bridge) monorepo. Used by both the adapter plugin and the responder service.

> **Status:** scaffold. Public API not yet stable.

## Exports

- `./config` — zod schema for `config.yaml`
- `./types` — `AgentRef`, `IssueContext`, `CommandResult`
- `./clients/chat` — Google Chat API wrapper (TBD)
- `./clients/paperclip` — Paperclip REST wrapper (TBD)
- `./commands` — slash-command parser (TBD)

## Install

```bash
pnpm add @d1dx/paperclip-gchat-bridge-shared
```

## License

MIT.
