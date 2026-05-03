import { describe, expect, it } from "vitest";
import { SqliteThreadStore } from "./sqlite.js";

function makeStore() {
  return new SqliteThreadStore({ path: ":memory:" });
}

describe("SqliteThreadStore — same contract as InMemory", () => {
  it("returns null for unknown (channel, thread) pair", async () => {
    const s = makeStore();
    expect(await s.get("gchat", "T1")).toBeNull();
    s.close();
  });

  it("upserts and reads back the same record", async () => {
    const s = makeStore();
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
    s.close();
  });

  it("upsert preserves startedAt across rebinds, updates lastActivityAt", async () => {
    const s = makeStore();
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
      activeIssueId: "ISS-2",
    });
    const second = await s.get("gchat", "T1");
    expect(second?.activeIssueId).toBe("ISS-2");
    expect(second?.startedAt).toBe(first?.startedAt);
    expect(second?.lastActivityAt).toBeGreaterThanOrEqual(first?.lastActivityAt ?? 0);
    s.close();
  });

  it("scopes by channel — same thread id different channel is isolated", async () => {
    const s = makeStore();
    await s.upsert({
      channel: "gchat",
      externalThreadId: "T1",
      agentId: "a1",
      activeIssueId: "ISS-1",
    });
    expect(await s.get("telegram", "T1")).toBeNull();
    s.close();
  });

  it("touch updates lastActivityAt on existing thread, no-op on missing", async () => {
    const s = makeStore();
    await s.upsert({
      channel: "gchat",
      externalThreadId: "T1",
      agentId: "a1",
      activeIssueId: "ISS-1",
    });
    const before = (await s.get("gchat", "T1"))!.lastActivityAt;
    await new Promise((r) => setTimeout(r, 5));
    await s.touch("gchat", "T1");
    const after = (await s.get("gchat", "T1"))!.lastActivityAt;
    expect(after).toBeGreaterThan(before);

    // missing thread is a silent no-op
    await expect(s.touch("gchat", "missing")).resolves.toBeUndefined();
    s.close();
  });
});
