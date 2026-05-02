/**
 * Config schema for the bridge — the shape of `config.yaml`.
 *
 * v0.1 stub — fields will be locked in during Phase 3 alongside the
 * Paperclip + Chat client wrappers.
 */

import { z } from "zod";

export const agentMappingSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  paperclip_role: z.string(),
  gchat_user_id: z.string(),
  gchat_email: z.string().email(),
  api_key_env: z.string(),
  language: z.string().optional(),
  timezone: z.string().optional(),
});

export const bridgeConfigSchema = z.object({
  paperclip: z.object({
    api_url: z.string().url(),
    company_id: z.string().uuid(),
  }),
  google_chat: z.object({
    bot_name: z.string().default("Paperclip"),
    service_account_json_env: z.string(),
    verification_token_env: z.string(),
  }),
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
