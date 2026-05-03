# @d1dx/paperclip-human-bridge-shared

Shared library for the [paperclip-human-bridge](https://github.com/D1DX/paperclip-human-bridge) monorepo. Used by both the adapter plugin and the responder service.

> **Status:** scaffold. Public API not yet stable.

## Exports

- `./config` — zod schema for `config.yaml` (channel-tagged discriminated union)
- `./types` — `AgentRef`, `IssueContext`, `CommandResult`, `ChannelId`
- `./channels` — channel registry (`registerChannel`, `getChannel`, `Channel` interface)
- `./channels/gchat` — Google Chat channel module (first concrete implementation)
- `./channels/telegram` · `./channels/slack` · `./channels/whatsapp` · `./channels/email` — placeholder channel modules

## Install

```bash
pnpm add @d1dx/paperclip-human-bridge-shared
```

## License

MIT.
