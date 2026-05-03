import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchInbound } from "./dispatch.js";
import { InMemoryThreadStore } from "./state/thread-state.js";
import type { ResolvedAgent } from "./agents/lookup.js";
import type { ChannelInboundResult, PaperclipClient } from "@d1dx/paperclip-human-bridge-shared";

function makePaperclipMock(): PaperclipClient & {
  _calls: Record<string, unknown[][]>;
} {
  const calls: Record<string, unknown[][]> = {
    getIssue: [],
    createComment: [],
    createWorkProduct: [],
    patchIssueStatus: [],
    createInteraction: [],
    respondInteraction: [],
  };
  const wrap =
    (name: keyof typeof calls) =>
    (...args: unknown[]) => {
      calls[name].push(args);
      return Promise.resolve({ id: `${name}-id` } as never);
    };
  return {
    getIssue: wrap("getIssue") as PaperclipClient["getIssue"],
    createComment: wrap("createComment") as PaperclipClient["createComment"],
    createWorkProduct: wrap("createWorkProduct") as PaperclipClient["createWorkProduct"],
    patchIssueStatus: wrap("patchIssueStatus") as PaperclipClient["patchIssueStatus"],
    createInteraction: wrap("createInteraction") as PaperclipClient["createInteraction"],
    respondInteraction: wrap("respondInteraction") as PaperclipClient["respondInteraction"],
    _calls: calls,
  };
}

const agent: ResolvedAgent = {
  entry: {
    id: "agent-1",
    name: "Daniel",
    channel: "gchat",
    channelConfig: { gchatUserId: "users/123" },
    apiKeyEnv: "PAPERCLIP_AGENT_DANIEL",
  },
  apiKey: "key-abc",
};

function makeInbound(
  command: ChannelInboundResult["command"],
): ChannelInboundResult & { _replies: string[] } {
  const replies: string[] = [];
  return {
    senderExternalId: "users/123",
    threadExternalId: "spaces/AAA/threads/TTT",
    command,
    replyInChannel: async (text) => {
      replies.push(text);
    },
    _replies: replies,
  };
}

describe("dispatchInbound — happy paths", () => {
  let paperclip: ReturnType<typeof makePaperclipMock>;
  let threads: InMemoryThreadStore;
  beforeEach(async () => {
    paperclip = makePaperclipMock();
    threads = new InMemoryThreadStore();
    await threads.upsert({
      channel: "gchat",
      externalThreadId: "spaces/AAA/threads/TTT",
      agentId: "agent-1",
      activeIssueId: "ISS-99",
    });
  });

  it("comment → createComment + reply", async () => {
    const inbound = makeInbound({ kind: "comment", body: "on it" });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("comment");
    expect(r.issueId).toBe("ISS-99");
    expect(paperclip._calls.createComment).toEqual([["ISS-99", "on it", "key-abc"]]);
    expect(inbound._replies).toEqual(["Comment posted."]);
  });

  it("done with summary → createWorkProduct + patchIssueStatus", async () => {
    const inbound = makeInbound({ kind: "done", summary: "shipped" });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("done");
    expect(paperclip._calls.createWorkProduct).toEqual([
      ["ISS-99", { title: "Done", body: "shipped" }, "key-abc"],
    ]);
    expect(paperclip._calls.patchIssueStatus).toEqual([["ISS-99", "done", "key-abc"]]);
  });

  it("done bare → defaults summary text", async () => {
    const inbound = makeInbound({ kind: "done" });
    await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(paperclip._calls.createWorkProduct[0][1]).toMatchObject({
      body: "Marked done by agent.",
    });
  });

  it("block → patchIssueStatus blocked + comment with reason", async () => {
    const inbound = makeInbound({ kind: "block", reason: "waiting on key" });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("block");
    expect(paperclip._calls.patchIssueStatus).toEqual([["ISS-99", "blocked", "key-abc"]]);
    expect(paperclip._calls.createComment).toEqual([["ISS-99", "Blocked: waiting on key", "key-abc"]]);
  });

  it("question → createInteraction kind=question", async () => {
    const inbound = makeInbound({ kind: "question", body: "which env?" });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("question");
    expect(paperclip._calls.createInteraction).toEqual([
      ["ISS-99", { kind: "question", body: "which env?" }, "key-abc"],
    ]);
  });

  it("attachment → createWorkProduct with attachmentIds", async () => {
    const inbound = makeInbound({
      kind: "attachment",
      body: "log",
      attachmentRefs: ["att-1", "att-2"],
    });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("attachment");
    expect(paperclip._calls.createWorkProduct).toEqual([
      ["ISS-99", { title: "Attachment", body: "log", attachmentIds: ["att-1", "att-2"] }, "key-abc"],
    ]);
  });
});

describe("dispatchInbound — special paths", () => {
  it("/help short-circuits before issue lookup", async () => {
    const paperclip = makePaperclipMock();
    const threads = new InMemoryThreadStore(); // empty — no thread bound
    const inbound = makeInbound({ kind: "help" });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("help");
    expect(inbound._replies[0]).toMatch(/\/done/);
    expect(paperclip._calls.createComment.length).toBe(0);
  });

  it("no thread bound → no-active-issue reply, no Paperclip calls", async () => {
    const paperclip = makePaperclipMock();
    const threads = new InMemoryThreadStore();
    const inbound = makeInbound({ kind: "comment", body: "hi" });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("no-active-issue");
    expect(paperclip._calls.createComment.length).toBe(0);
  });

  it("agent mismatch on bound thread → refuse dispatch", async () => {
    const paperclip = makePaperclipMock();
    const threads = new InMemoryThreadStore();
    await threads.upsert({
      channel: "gchat",
      externalThreadId: "spaces/AAA/threads/TTT",
      agentId: "different-agent",
      activeIssueId: "ISS-99",
    });
    const inbound = makeInbound({ kind: "comment", body: "x" });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("unknown");
    expect(paperclip._calls.createComment.length).toBe(0);
    expect(inbound._replies[0]).toMatch(/Refusing dispatch/);
  });

  it("unknown command → reply with grammar hint, no Paperclip calls", async () => {
    const paperclip = makePaperclipMock();
    const threads = new InMemoryThreadStore();
    await threads.upsert({
      channel: "gchat",
      externalThreadId: "spaces/AAA/threads/TTT",
      agentId: "agent-1",
      activeIssueId: "ISS-99",
    });
    const inbound = makeInbound({ kind: "unknown", raw: "/release" });
    const r = await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(r.action).toBe("unknown");
    expect(paperclip._calls.createComment.length).toBe(0);
    expect(inbound._replies[0]).toMatch(/help/);
  });
});

describe("dispatchInbound — touches thread on activity", () => {
  it("calls threads.touch on every dispatched action", async () => {
    const paperclip = makePaperclipMock();
    const threads = new InMemoryThreadStore();
    const touchSpy = vi.spyOn(threads, "touch");
    await threads.upsert({
      channel: "gchat",
      externalThreadId: "spaces/AAA/threads/TTT",
      agentId: "agent-1",
      activeIssueId: "ISS-99",
    });
    const inbound = makeInbound({ kind: "comment", body: "x" });
    await dispatchInbound({ channel: "gchat", inbound, agent, paperclip, threads });
    expect(touchSpy).toHaveBeenCalledWith("gchat", "spaces/AAA/threads/TTT");
  });
});
