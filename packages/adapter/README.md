# @d1dx/paperclip-human-adapter

Paperclip plugin that registers a `human` adapter type for human agents reachable via a configurable channel (Google Chat in v0.1; Telegram, Slack, WhatsApp, email planned).

> **Status:** scaffold (v0.1.0-pre). Channel dispatch wired; channel `send()` implementations are stubs until Phase 3.

## Install into Paperclip

```bash
# inside the Paperclip container/host:
cd /paperclip/adapter-plugins
pnpm add @d1dx/paperclip-human-adapter
# then restart Paperclip OR hot-reload via the admin API:
#   POST /api/adapters/human/reload
```

After install, `human` should appear in `GET /api/adapters` and in the create-agent UI dropdown.

## Configure an agent (Google Chat)

```bash
curl -X POST https://paperclip.example.com/api/companies/<company-id>/agents \
  -H "Authorization: Bearer <board-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wannapa Boonsri",
    "role": "engineer",
    "adapterType": "human",
    "adapterConfig": {
      "channel": "gchat",
      "gchatUserId": "users/12345678901234567890",
      "responderUrl": "https://human-bridge.example.com",
      "language": "en",
      "timezone": "Asia/Bangkok"
    },
    "runtimeConfig": { "heartbeat": { "enabled": false } }
  }'
```

Other channels (`telegram`, `slack`, `whatsapp`, `email`) accept the same `adapterType: "human"` with their own `adapterConfig` shape — but throw "not implemented" until their respective phases land.

## Companion service

This plugin only handles *outbound* (issue assigned → channel message sent). For *inbound* (channel reply → Paperclip comment) you also need [`@d1dx/paperclip-human-responder`](../responder).

## License

MIT.
