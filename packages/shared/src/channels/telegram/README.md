# Telegram channel — placeholder

Not implemented in v0.1.0. Follow the `gchat` module pattern:

- Implement a `Channel` object with `send()` and `parseInboundEvent()`
- Add a typed `TelegramAdapterConfig` interface with channel-specific fields
- Register from `packages/adapter/src/index.ts`
- Add tests under `__tests__/`
- Update root README's channel matrix
