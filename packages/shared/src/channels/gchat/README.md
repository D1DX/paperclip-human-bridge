# Google Chat channel

First concrete `Channel` implementation in this repo. Reference for any future channel module.

## Adapter config shape

```ts
{
  channel: "gchat",
  gchatUserId: string,    // "users/12345..."
  responderUrl: string,   // public URL of the responder
  language?: string,      // ISO code, default "en"
  timezone?: string,      // IANA, default "UTC"
}
```

## Required env at the Paperclip side (read by adapter)

- `GCHAT_SERVICE_ACCOUNT_JSON` — single-line service account JSON
- `GCHAT_BOT_NAME` — display name (default `Paperclip`)

## Required env at the responder side

- `GCHAT_VERIFICATION_TOKEN` — Google sends this on every event for auth
- `GCHAT_SERVICE_ACCOUNT_JSON` — for fetching profiles + attachments

## Status

v0.1.0-pre — `send()` + `parseInboundEvent()` are stubs. Phase 3.
