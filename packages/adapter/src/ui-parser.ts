/**
 * UI parser export — surfaces the gchat adapter in Paperclip's create-agent UI.
 *
 * Declared via the package.json `paperclip.adapterUiParser: "1"` field, picked up
 * by Paperclip's plugin-loader when the package is installed.
 *
 * v0.1 stub — full UI parser shape will be implemented alongside the
 * `agentConfigurationDoc` in Phase 4.
 */

export const adapterUiParserContractVersion = "1" as const;

export const fields = [
  {
    key: "gchatUserId",
    label: "Google Chat user ID",
    type: "string",
    required: true,
    placeholder: "users/12345678901234567890",
    help: "Google Chat user resource name. Find via the Chat API: spaces.members.list on the bot's DM space, or the Workspace admin console.",
  },
  {
    key: "responderUrl",
    label: "Responder URL",
    type: "url",
    required: true,
    placeholder: "https://gchat-bridge.example.com",
    help: "Public URL of the @d1dx/paperclip-gchat-responder service handling this agent's reply events.",
  },
  {
    key: "language",
    label: "Language",
    type: "string",
    required: false,
    default: "en",
    help: "ISO language code (en, he, th, ...). Affects DM formatting.",
  },
  {
    key: "timezone",
    label: "Timezone",
    type: "string",
    required: false,
    default: "UTC",
    help: "IANA timezone (e.g. Asia/Bangkok). Used for 'X minutes ago' rendering.",
  },
] as const;
