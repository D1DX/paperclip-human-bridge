import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeGchatParser } from "./parser.js";
import type { ServiceAccountKey } from "./client.js";

vi.mock("google-auth-library", () => ({
  JWT: class {
    async getAccessToken() {
      return { token: "fake-access-token" };
    }
  },
}));

const SA: ServiceAccountKey = {
  client_email: "test@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
};

const VTOKEN = "verify-token-abc123";

function makeRequest(body: unknown, token: string | null = VTOKEN): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers["X-Verification-Token"] = token;
  return new Request("https://example.test/event/gchat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const baseEvent = {
  type: "MESSAGE",
  user: { name: "users/123", displayName: "Daniel" },
  space: { name: "spaces/AAA" },
  message: {
    name: "spaces/AAA/messages/MMM.NNN",
    text: "I'm on it",
    thread: { name: "spaces/AAA/threads/TTT" },
  },
};

describe("gchat parser — token verification", () => {
  const parse = makeGchatParser({ serviceAccount: SA, verificationToken: VTOKEN });

  it("rejects missing token header", async () => {
    await expect(
      parse({ request: makeRequest(baseEvent, null) }),
    ).rejects.toThrow(/missing X-Verification-Token/);
  });

  it("rejects mismatched token", async () => {
    await expect(
      parse({ request: makeRequest(baseEvent, "wrong") }),
    ).rejects.toThrow(/X-Verification-Token mismatch/);
  });

  it("accepts matching token", async () => {
    const result = await parse({ request: makeRequest(baseEvent) });
    expect(result.senderExternalId).toBe("users/123");
  });
});

describe("gchat parser — event extraction", () => {
  const parse = makeGchatParser({ serviceAccount: SA, verificationToken: VTOKEN });

  it("extracts sender, thread, and parses comment", async () => {
    const result = await parse({ request: makeRequest(baseEvent) });
    expect(result).toMatchObject({
      senderExternalId: "users/123",
      threadExternalId: "spaces/AAA/threads/TTT",
      command: { kind: "comment", body: "I'm on it" },
    });
    expect(typeof result.replyInChannel).toBe("function");
  });

  it("parses /done with summary", async () => {
    const ev = {
      ...baseEvent,
      message: { ...baseEvent.message, text: "/done deployed" },
    };
    const result = await parse({ request: makeRequest(ev) });
    expect(result.command).toEqual({ kind: "done", summary: "deployed" });
  });

  it("collects attachment names → attachment kind", async () => {
    const ev = {
      ...baseEvent,
      message: {
        ...baseEvent.message,
        text: "see file",
        attachment: [
          { name: "spaces/AAA/messages/MMM/attachments/CCC", contentName: "log.txt" },
          { name: "spaces/AAA/messages/MMM/attachments/DDD", contentName: "img.png" },
        ],
      },
    };
    const result = await parse({ request: makeRequest(ev) });
    expect(result.command).toEqual({
      kind: "attachment",
      body: "see file",
      attachmentRefs: [
        "spaces/AAA/messages/MMM/attachments/CCC",
        "spaces/AAA/messages/MMM/attachments/DDD",
      ],
    });
  });

  it("rejects unsupported event type", async () => {
    const ev = { ...baseEvent, type: "ADDED_TO_SPACE" };
    await expect(parse({ request: makeRequest(ev) })).rejects.toThrow(
      /event type "ADDED_TO_SPACE" not supported/,
    );
  });

  it("rejects event missing user.name", async () => {
    const ev = { ...baseEvent, user: {} };
    await expect(parse({ request: makeRequest(ev) })).rejects.toThrow(
      /missing user\.name/,
    );
  });

  it("rejects event missing thread.name", async () => {
    const ev = {
      ...baseEvent,
      message: { ...baseEvent.message, thread: {} },
    };
    await expect(parse({ request: makeRequest(ev) })).rejects.toThrow(
      /missing message\.thread\.name/,
    );
  });
});

describe("gchat parser — replyInChannel closure", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "spaces/AAA/messages/REPLY",
          thread: { name: "spaces/AAA/threads/TTT" },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts back to the same thread with extracted threadKey", async () => {
    const parse = makeGchatParser({ serviceAccount: SA, verificationToken: VTOKEN });
    const result = await parse({ request: makeRequest(baseEvent) });
    await result.replyInChannel("got it");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("threadKey=TTT");
    expect(JSON.parse(init.body as string)).toMatchObject({
      text: "got it",
      thread: { threadKey: "TTT" },
    });
  });
});
