import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendDmMessage, type ServiceAccountKey } from "./client.js";

// Minimal stub of google-auth-library — bypass real JWT signing.
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

describe("sendDmMessage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts to the spaces/{space}/messages endpoint with bearer token + JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "spaces/AAA/messages/MMM.NNN",
          thread: { name: "spaces/AAA/threads/TTT" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await sendDmMessage(SA, "spaces/AAA", "hello world");

    expect(result).toEqual({
      messageName: "spaces/AAA/messages/MMM.NNN",
      threadName: "spaces/AAA/threads/TTT",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://chat.googleapis.com/v1/spaces/AAA/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer fake-access-token");
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ text: "hello world" });
  });

  it("includes threadKey query param + body.thread when replying", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          name: "spaces/AAA/messages/MMM.NNN",
          thread: { name: "spaces/AAA/threads/EXISTING" },
        }),
        { status: 200 },
      ),
    );

    await sendDmMessage(SA, "spaces/AAA", "reply text", "issue-123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
    expect(url).toContain("threadKey=issue-123");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "reply text",
      thread: { threadKey: "issue-123" },
    });
  });

  it("throws on non-2xx with status + body in the error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("PERMISSION_DENIED: missing chat.bot scope", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    await expect(sendDmMessage(SA, "spaces/AAA", "x")).rejects.toThrow(
      /403 Forbidden — PERMISSION_DENIED/,
    );
  });

  it("throws on missing name/thread.name in response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ name: "spaces/AAA/messages/M" }), {
        status: 200,
      }),
    );

    await expect(sendDmMessage(SA, "spaces/AAA", "x")).rejects.toThrow(
      /missing name\/thread\.name/,
    );
  });
});
