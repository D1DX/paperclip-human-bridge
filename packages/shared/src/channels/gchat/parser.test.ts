import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeGchatParser } from "./parser.js";
import type { ServiceAccountKey } from "./client.js";

vi.mock("google-auth-library", () => ({
  JWT: class {
    async getAccessToken() {
      return { token: "fake-access-token" };
    }
  },
  OAuth2Client: class {
    async verifyIdToken() {
      throw new Error("test must inject oauth2Client override");
    }
  },
}));

const SA: ServiceAccountKey = {
  client_email: "test@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
};

const AUDIENCE = "https://human-bridge.example.com";
const CHAT_ISSUER = "chat@system.gserviceaccount.com";

/** Build a minimal mock OAuth2Client that returns the supplied payload. */
function makeMockVerifier(payload: { iss?: string; aud?: string | string[]; email?: string } | undefined) {
  return {
    verifyIdToken: vi.fn(async () => ({
      getPayload: () => payload,
    })),
  };
}

/** Build a verifier that throws (e.g. signature failure, expired token). */
function makeFailingVerifier(message: string) {
  return {
    verifyIdToken: vi.fn(async () => {
      throw new Error(message);
    }),
  };
}

function makeRequest(body: unknown, authHeader: string | null = `Bearer fake.jwt.token`): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader !== null) headers["Authorization"] = authHeader;
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

const happyPayload = { iss: CHAT_ISSUER, aud: AUDIENCE, email: CHAT_ISSUER };

describe("gchat parser — JWT verification", () => {
  it("rejects missing Authorization header", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier(happyPayload),
    });
    await expect(
      parse({ request: makeRequest(baseEvent, null) }),
    ).rejects.toThrow(/missing Authorization header/);
  });

  it("rejects non-Bearer Authorization", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier(happyPayload),
    });
    await expect(
      parse({ request: makeRequest(baseEvent, "Basic abc123") }),
    ).rejects.toThrow(/not a Bearer token/);
  });

  it("rejects empty Bearer token", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier(happyPayload),
    });
    await expect(
      parse({ request: makeRequest(baseEvent, "Bearer    ") }),
    ).rejects.toThrow(/empty/);
  });

  it("rejects when verifyIdToken throws (bad signature / expired / wrong audience)", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeFailingVerifier("Wrong recipient, payload audience != requiredAudience"),
    });
    await expect(parse({ request: makeRequest(baseEvent) })).rejects.toThrow(
      /OIDC JWT verification failed/,
    );
  });

  it("rejects when payload is undefined", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier(undefined),
    });
    await expect(parse({ request: makeRequest(baseEvent) })).rejects.toThrow(
      /no payload/,
    );
  });

  it("rejects when iss is not chat@system.gserviceaccount.com", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier({ iss: "evil@attacker.com", aud: AUDIENCE }),
    });
    await expect(parse({ request: makeRequest(baseEvent) })).rejects.toThrow(
      /iss "evil@attacker.com" is not/,
    );
  });

  it("rejects when aud does not match expected audience (defensive check)", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier({ iss: CHAT_ISSUER, aud: "https://other.example" }),
    });
    await expect(parse({ request: makeRequest(baseEvent) })).rejects.toThrow(
      /aud "https:\/\/other\.example" does not match expected/,
    );
  });

  it("accepts valid JWT (iss + aud both correct)", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier(happyPayload),
    });
    const result = await parse({ request: makeRequest(baseEvent) });
    expect(result.senderExternalId).toBe("users/123");
  });

  it("accepts JWT whose aud is an array containing the expected audience", async () => {
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier({ iss: CHAT_ISSUER, aud: [AUDIENCE, "https://other"] }),
    });
    const result = await parse({ request: makeRequest(baseEvent) });
    expect(result.senderExternalId).toBe("users/123");
  });
});

describe("gchat parser — event extraction", () => {
  function newParse() {
    return makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier(happyPayload),
    });
  }

  it("extracts sender, thread, and parses comment", async () => {
    const result = await newParse()({ request: makeRequest(baseEvent) });
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
    const result = await newParse()({ request: makeRequest(ev) });
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
    const result = await newParse()({ request: makeRequest(ev) });
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
    await expect(newParse()({ request: makeRequest(ev) })).rejects.toThrow(
      /event type "ADDED_TO_SPACE" not supported/,
    );
  });

  it("rejects event missing user.name", async () => {
    const ev = { ...baseEvent, user: {} };
    await expect(newParse()({ request: makeRequest(ev) })).rejects.toThrow(
      /missing user\.name/,
    );
  });

  it("rejects event missing thread.name", async () => {
    const ev = {
      ...baseEvent,
      message: { ...baseEvent.message, thread: {} },
    };
    await expect(newParse()({ request: makeRequest(ev) })).rejects.toThrow(
      /missing message\.thread\.name/,
    );
  });
});

describe("gchat parser — replyInChannel closure", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () =>
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
    const parse = makeGchatParser({
      serviceAccount: SA,
      audience: AUDIENCE,
      oauth2Client: makeMockVerifier(happyPayload),
    });
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
