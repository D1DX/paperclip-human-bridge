import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the shared module BEFORE importing the adapter so the adapter's
// module-init `registerChannel(...)` calls hit the stub registry.
vi.mock("@d1dx/paperclip-human-bridge-shared", async () => {
  const actual = await vi.importActual<
    typeof import("@d1dx/paperclip-human-bridge-shared")
  >("@d1dx/paperclip-human-bridge-shared");
  const reg = new Map<string, unknown>();
  return {
    ...actual,
    registerChannel: (ch: { id: string }) => {
      reg.set(ch.id, ch);
    },
    getChannel: (id: string) => {
      const c = reg.get(id);
      if (!c) throw new Error(`mock: channel "${id}" not registered`);
      return c;
    },
    listChannels: () => [...reg.keys()],
    gchatChannel: {
      id: "gchat",
      displayName: "Google Chat",
      send: vi.fn(),
      parseInboundEvent: vi.fn(),
    },
    telegramChannel: { id: "telegram", displayName: "Telegram", send: vi.fn(), parseInboundEvent: vi.fn() },
    slackChannel: { id: "slack", displayName: "Slack", send: vi.fn(), parseInboundEvent: vi.fn() },
    whatsappChannel: { id: "whatsapp", displayName: "WhatsApp", send: vi.fn(), parseInboundEvent: vi.fn() },
    emailChannel: { id: "email", displayName: "Email", send: vi.fn(), parseInboundEvent: vi.fn() },
  };
});

import {
  createServerAdapter,
  mapExecuteCtxToChannelSend,
  ADAPTER_TYPE,
} from "./index.js";
import { gchatChannel } from "@d1dx/paperclip-human-bridge-shared";

const baseCtx = {
  runId: "run-1",
  agent: {
    id: "agent-uuid-1",
    name: "Daniel",
    role: "engineer",
    adapterConfig: {
      channel: "gchat" as const,
      gchatUserSpace: "spaces/AAA",
      gchatUserId: "users/123",
      responderUrl: "https://human-bridge.example.com",
    },
  },
  context: {
    issue: {
      id: "ISS-99",
      title: "Investigate flaky test",
      body: "fails ~10% of the time",
      status: "open",
      url: "https://paperclip.example/i/ISS-99",
    },
    wakeReason: "assigned",
  },
};

describe("ADAPTER_TYPE", () => {
  it('is "human"', () => {
    expect(ADAPTER_TYPE).toBe("human");
  });
});

describe("mapExecuteCtxToChannelSend", () => {
  it("maps full ctx → channel send ctx", () => {
    const { channelId, sendCtx } = mapExecuteCtxToChannelSend(baseCtx);
    expect(channelId).toBe("gchat");
    expect(sendCtx.agent).toMatchObject({
      id: "agent-uuid-1",
      name: "Daniel",
      role: "engineer",
      channel: "gchat",
      apiKeyEnv: "PAPERCLIP_AGENT_AGENT_UUID_1",
    });
    expect(sendCtx.agent.channelConfig).toEqual({
      gchatUserSpace: "spaces/AAA",
      gchatUserId: "users/123",
      responderUrl: "https://human-bridge.example.com",
    });
    // The `channel` discriminator is stripped from channelConfig:
    expect(
      (sendCtx.agent.channelConfig as Record<string, unknown>).channel,
    ).toBeUndefined();
    expect(sendCtx.issue.id).toBe("ISS-99");
    expect(sendCtx.wakeReason).toBe("assigned");
  });

  it("defaults wakeReason to 'assigned' when missing", () => {
    const ctx = { ...baseCtx, context: { issue: baseCtx.context.issue } };
    const { sendCtx } = mapExecuteCtxToChannelSend(ctx);
    expect(sendCtx.wakeReason).toBe("assigned");
  });

  it("forwards bodyOverride", () => {
    const ctx = {
      ...baseCtx,
      context: { ...baseCtx.context, bodyOverride: "follow-up text" },
    };
    const { sendCtx } = mapExecuteCtxToChannelSend(ctx);
    expect(sendCtx.bodyOverride).toBe("follow-up text");
  });

  it("throws when channel is missing", () => {
    const ctx = {
      ...baseCtx,
      agent: { ...baseCtx.agent, adapterConfig: { gchatUserId: "x" } as Record<string, unknown> },
    };
    expect(() => mapExecuteCtxToChannelSend(ctx as never)).toThrow(/no `channel` set/);
  });

  it("throws when issue field missing", () => {
    const ctx = {
      ...baseCtx,
      context: {
        issue: { ...baseCtx.context.issue, body: "" },
        wakeReason: "assigned",
      },
    };
    expect(() => mapExecuteCtxToChannelSend(ctx)).toThrow(/missing context\.issue\.body/);
  });
});

describe("createServerAdapter().execute", () => {
  let adapter: ReturnType<typeof createServerAdapter>;
  beforeEach(() => {
    adapter = createServerAdapter();
    (gchatChannel.send as ReturnType<typeof vi.fn>).mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns exitCode 0 + summary + externalId on channel.send success", async () => {
    (gchatChannel.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      externalId: "spaces/AAA/messages/M1",
      summary: "Sent DM to Daniel",
    });
    const result = await adapter.execute(baseCtx);
    expect(result).toEqual({
      exitCode: 0,
      summary: "Sent DM to Daniel",
      externalId: "spaces/AAA/messages/M1",
    });
    expect(gchatChannel.send).toHaveBeenCalledTimes(1);
    const sentCtx = (gchatChannel.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sentCtx.issue.id).toBe("ISS-99");
    expect(sentCtx.agent.channel).toBe("gchat");
  });

  it("returns exitCode 1 + errorCode + errorMessage on channel.send failure", async () => {
    (gchatChannel.send as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Chat API 403"),
    );
    const result = await adapter.execute(baseCtx);
    expect(result).toMatchObject({
      exitCode: 1,
      errorMessage: "Chat API 403",
    });
  });

  it("returns exitCode 1 with mapping error message when channel missing", async () => {
    const ctx = {
      ...baseCtx,
      agent: { ...baseCtx.agent, adapterConfig: { gchatUserId: "x" } as Record<string, unknown> },
    };
    const result = await adapter.execute(ctx as never);
    expect(result.exitCode).toBe(1);
    expect(result.errorMessage).toMatch(/no `channel` set/);
  });
});

describe("createServerAdapter().testEnvironment", () => {
  it("ok=true when channel is registered", async () => {
    const adapter = createServerAdapter();
    const r = await adapter.testEnvironment(baseCtx);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/gchat/);
  });

  it("ok=false when channel field missing", async () => {
    const adapter = createServerAdapter();
    const r = await adapter.testEnvironment({
      ...baseCtx,
      agent: { ...baseCtx.agent, adapterConfig: {} as Record<string, unknown> },
    } as never);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/no `channel` set/);
  });
});
