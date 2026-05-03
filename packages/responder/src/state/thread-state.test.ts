import { describe, expect, it } from "vitest";
import { InMemoryThreadStore } from "./thread-state.js";

describe("InMemoryThreadStore", () => {
  it("returns null for unknown (channel, thread) pair", async () => {
    const s = new InMemoryThreadStore();
    expect(await s.get("gchat", "T1")).toBeNull();
  });

  it("upserts and reads back the same record", async () => {
    const s = new InMemoryThreadStore();
    await s.upsert({
      channel: "gchat",
      externalThreadId: "T1",
      agentId: "a1",
      activeIssueId: "ISS-1",
    });
    const r = await s.get("gchat", "T1");
    expect(r).toMatchObject({
      channel: "gchat",
      externalThreadId: "T1",
      agentId: "a1",
      activeIssueId: "ISS-1",
    });
    expect(typeof r?.startedAt).toBe("number");
    expect(typeof r?.lastActivityAt).toBe("number");
  });

  it("upsert preserves startedAt across rebinds, updates lastActivityAt", async () => {
    const s = new InMemoryThreadStore();
    await s.upsert({
      channel: "gchat",
      externalThreadId: "T1",
      agentId: "a1",
      activeIssueId: "ISS-1",
    });
    const first = await s.get("gchat", "T1");
    await new Promise((r) => setTimeout(r, 5));
    await s.upsert({
      channel: "gchat",
      externalThreadId: "T1",
      agentId: "a1",
      activeIssueId: "ISS-2", // rebind to a different issue
    });
    const second = await s.get("gchat", "T1");
    expect(second?.activeIssueId).toBe("ISS-2");
    expect(second?.startedAt).toBe(first?.startedAt);
    expect(second?.lastActivityAt).toBeGreaterThanOrEqual(first?.lastActivityAt ?? 0);
  });

  it("scopes by channel — same thread id different channel is isolated", async () => {
    const s = new InMemoryThreadStore();
    await s.upsert({
      channel: "gchat",
      externalThreadId: "T1",
      agentId: "a1",
      activeIssueId: "ISS-1",
    });
    expect(await s.get("telegram", "T1")).toBeNull();
  });

  it("touch is a no-op for unknown threads", async () => {
    const s = new InMemoryThreadStore();
    await expect(s.touch("gchat", "missing")).resolves.toBeUndefined();
  });
});
