/**
 * Config schema for the bridge — the shape of `config.yaml`.
 *
 * Per-agent `channel` is a discriminated union by the `channel` field.
 * Only `gchat` ships in v0.1.0; other channel variants reject in zod
 * with a helpful "not implemented" message.
 */

import { z } from "zod";

const gchatAgentSchema = z.object({
  channel: z.literal("gchat"),
  gchat_user_id: z.string().regex(/^users\/\d+$/u, "expect Google Chat user resource name like users/12345..."),
  responder_url: z.string().url(),
});

const notYetImplemented = (id: string) =>
  z
    .object({ channel: z.literal(id) })
    .passthrough()
    .superRefine((_, ctx) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `[paperclip-human] Channel "${id}" is not implemented in v0.1.0. Use channel: "gchat" or wait for the next minor.`,
      });
    });

const channelSpecificSchema = z.discriminatedUnion("channel", [
  gchatAgentSchema,
  // Stubs to keep the discriminator total — they will fail validation with a clear message.
  z.object({ channel: z.literal("telegram") }).passthrough(),
  z.object({ channel: z.literal("slack") }).passthrough(),
  z.object({ channel: z.literal("whatsapp") }).passthrough(),
  z.object({ channel: z.literal("email") }).passthrough(),
]);

export const agentMappingSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    paperclip_role: z.string(),
    api_key_env: z.string(),
    language: z.string().optional(),
    timezone: z.string().optional(),
  })
  .and(channelSpecificSchema);

export const bridgeConfigSchema = z.object({
  paperclip: z.object({
    api_url: z.string().url(),
    company_id: z.string().uuid(),
  }),
  channels: z
    .object({
      gchat: z
        .object({
          bot_name: z.string().default("Paperclip"),
          service_account_json_env: z.string(),
          verification_token_env: z.string(),
        })
        .optional(),
      // Future: telegram, slack, whatsapp, email channel-level config blocks
    })
    .default({}),
  storage: z.object({
    thread_state_path: z.string(),
  }),
  logging: z
    .object({
      level: z.enum(["debug", "info", "warn", "error"]).default("info"),
      ntfy_url: z.string().url().optional(),
    })
    .default({ level: "info" }),
  agents: z.array(agentMappingSchema),
});

export type BridgeConfig = z.infer<typeof bridgeConfigSchema>;
export type AgentMapping = z.infer<typeof agentMappingSchema>;
