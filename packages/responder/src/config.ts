/**
 * Responder config loader — parses `config.yaml` into `AgentEntry[]`.
 *
 * Schema (decisions.md row 12):
 *
 *   agents:
 *     - id: agent-uuid-1
 *       name: Daniel
 *       role: engineer
 *       channel: gchat
 *       channelConfig:
 *         gchatUserId: users/12345
 *         gchatUserSpace: spaces/AAA
 *       apiKeyEnv: PAPERCLIP_AGENT_DANIEL
 *
 * apiKey values themselves never live in this file — only the env-var
 * NAME (per decisions row 11, one secret one consumer). The actual
 * key is read via process.env at agent-resolve time.
 */
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { AgentEntry } from "./agents/lookup.js";

const ChannelIdSchema = z.enum(["gchat", "telegram", "slack", "whatsapp", "email"]);

const AgentEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().optional(),
  channel: ChannelIdSchema,
  channelConfig: z.record(z.unknown()),
  apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "must be UPPER_SNAKE env var name"),
});

export const ResponderConfigSchema = z.object({
  agents: z.array(AgentEntrySchema),
});

export type ResponderConfig = z.infer<typeof ResponderConfigSchema>;

export function parseResponderConfig(yamlText: string): ResponderConfig {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (e) {
    throw new Error(`[responder config] YAML parse failed: ${(e as Error).message}`);
  }
  const result = ResponderConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[responder config] schema validation failed: ${result.error.toString()}`,
    );
  }
  // Catch duplicate ids — silent collisions cause wrong-agent dispatch.
  const seen = new Set<string>();
  for (const a of result.data.agents) {
    if (seen.has(a.id)) {
      throw new Error(`[responder config] duplicate agent id: ${a.id}`);
    }
    seen.add(a.id);
  }
  return result.data;
}

export function loadResponderConfigFromFile(path: string): AgentEntry[] {
  const text = readFileSync(path, "utf8");
  return parseResponderConfig(text).agents;
}
