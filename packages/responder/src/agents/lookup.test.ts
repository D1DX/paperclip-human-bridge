import { describe, expect, it } from "vitest";
import { buildAgentLookup, type AgentEntry } from "./lookup.js";

const agents: AgentEntry[] = [
  {
    id: "agent-daniel",
    name: "Daniel",
    channel: "gchat",
    channelConfig: { gchatUserId: "users/123" },
    apiKeyEnv: "PAPERCLIP_AGENT_DANIEL",
  },
  {
    id: "agent-wannapa",
    name: "Wannapa",
    channel: "gchat",
    channelConfig: { gchatUserId: "users/456" },
    apiKeyEnv: "PAPERCLIP_AGENT_WANNAPA",
  },
  {
    id: "agent-tg",
    name: "TG-Test",
    channel: "telegram",
    channelConfig: { telegramChatId: "tg-789" },
    apiKeyEnv: "PAPERCLIP_AGENT_TG",
  },
];

describe("buildAgentLookup", () => {
  it("resolves a known sender on the right channel", async () => {
    const lookup = buildAgentLookup({
      agents,
      keyResolver: () => "key-fixed",
    });
    const r = await lookup.resolveBySender("gchat", "users/123");
    expect(r?.entry.id).toBe("agent-daniel");
    expect(r?.apiKey).toBe("key-fixed");
  });

  it("returns null for unknown sender", async () => {
    const lookup = buildAgentLookup({ agents, keyResolver: () => "k" });
    expect(await lookup.resolveBySender("gchat", "users/UNKNOWN")).toBeNull();
  });

  it("scopes by channel — same id on a different channel returns null", async () => {
    const lookup = buildAgentLookup({ agents, keyResolver: () => "k" });
    expect(await lookup.resolveBySender("telegram", "users/123")).toBeNull();
  });

  it("resolves on telegram via telegramChatId", async () => {
    const lookup = buildAgentLookup({ agents, keyResolver: () => "k" });
    const r = await lookup.resolveBySender("telegram", "tg-789");
    expect(r?.entry.id).toBe("agent-tg");
  });

  it("throws when apiKeyEnv resolver returns undefined", async () => {
    const lookup = buildAgentLookup({ agents, keyResolver: () => undefined });
    await expect(lookup.resolveBySender("gchat", "users/123")).rejects.toThrow(
      /apiKeyEnv .* not set/,
    );
  });
});
