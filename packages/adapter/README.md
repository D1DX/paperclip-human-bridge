# @d1dx/paperclip-gchat-adapter

Paperclip plugin that registers a `gchat` adapter type for human agents reachable via Google Chat direct messages.

> **Status:** scaffold (v0.1.0-pre). `execute()` is intentionally a stub that throws until Phase 4 lands.

## Install into Paperclip

The plugin lives in Paperclip's `adapter-plugins/` store.

```bash
# inside the Paperclip container/host:
cd /paperclip/adapter-plugins
pnpm add @d1dx/paperclip-gchat-adapter
# then restart Paperclip OR hot-reload via the admin API:
#   POST /api/adapters/gchat/reload
```

After install, `gchat` should appear in `GET /api/adapters` and in the create-agent UI dropdown.

## Configure an agent

```bash
curl -X POST https://paperclip.example.com/api/companies/<company-id>/agents \
  -H "Authorization: Bearer <board-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wannapa Boonsri",
    "role": "engineer",
    "adapterType": "gchat",
    "adapterConfig": {
      "gchatUserId": "users/12345678901234567890",
      "responderUrl": "https://gchat-bridge.example.com",
      "language": "en",
      "timezone": "Asia/Bangkok"
    },
    "runtimeConfig": { "heartbeat": { "enabled": false } }
  }'
```

## Companion service

This plugin only handles *outbound* (issue assigned → DM sent). For *inbound* (DM reply → Paperclip comment) you also need [`@d1dx/paperclip-gchat-responder`](../responder).

## License

MIT.
