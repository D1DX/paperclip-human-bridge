/**
 * UI parser export — surfaces the human adapter in Paperclip's create-agent UI.
 *
 * v0.1: channel field is a select with "gchat" + four placeholder options.
 * Channel-specific fields render conditionally based on the `channel` choice.
 * Only the gchat fields are real in v0.1.
 */

export const adapterUiParserContractVersion = "1" as const;

export const fields = [
  {
    key: "channel",
    label: "Channel",
    type: "select",
    required: true,
    options: [
      { value: "gchat", label: "Google Chat" },
      { value: "telegram", label: "Telegram (not yet implemented)" },
      { value: "slack", label: "Slack (not yet implemented)" },
      { value: "whatsapp", label: "WhatsApp (not yet implemented)" },
      { value: "email", label: "Email (not yet implemented)" },
    ],
    help: "Which channel to use for this human agent. Only Google Chat is implemented in v0.1.",
  },
  {
    key: "gchatUserId",
    label: "Google Chat user ID",
    type: "string",
    required: true,
    showIf: { channel: "gchat" },
    placeholder: "users/12345678901234567890",
    help: "Google Chat user resource name. Find via the Chat API or the Workspace admin console.",
  },
  {
    key: "responderUrl",
    label: "Responder URL",
    type: "url",
    required: true,
    showIf: { channel: "gchat" },
    placeholder: "https://human-bridge.example.com",
    help: "Public URL of the @d1dx/paperclip-human-responder service handling reply events for this agent.",
  },
  {
    key: "language",
    label: "Language",
    type: "string",
    required: false,
    default: "en",
    help: "ISO language code (en, he, th, ...). Affects message formatting.",
  },
  {
    key: "timezone",
    label: "Timezone",
    type: "string",
    required: false,
    default: "UTC",
    help: "IANA timezone (e.g. Asia/Bangkok). Used for relative time rendering.",
  },
] as const;
