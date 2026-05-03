import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeGchatChannel, renderIssueMessage } from "./index.js";
import type { ServiceAccountKey } from "./client.js";
import type { AgentRef, IssueContext } from "../../types.js";

vi.mock("google-auth-library", () => ({
  JWT: class {
    async getAccessToken() {
      return { token: "fake-access-token" };
    }
  },
  OAuth2Client: class {
    async verifyIdToken() {
      // index.test.ts only exercises send() + renderIssueMessage —
      // never invokes the parser, so this stub never executes.
      throw new Error("not used in send-side tests");
    }
  },
}));

const SA: ServiceAccountKey = {
  client_email: "test@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
};

const AUDIENCE = "https://human-bridge.example.test";

const issue: IssueContext = {
  id: "ISS-123",
  title: "Fix the thing",
  body: "Detailed description.",
  status: "in_progress",
  url: "https://paperclip.example/i/ISS-123",
};

const agent: AgentRef = {
  id: "agent-uuid",
  name: "Daniel",
  role: "engineer",
  channel: "gchat",
  channelConfig: { gchatUserSpace: "spaces/AAA" },
  apiKeyEnv: "PAPERCLIP_AGENT_DANIEL",
};

describe("renderIssueMessage", () => {
  it("includes issue id, title, status, link, body, and reply hint", () => {
    const text = renderIssueMessage({ issue, wakeReason: "assigned" });
    expect(text).toMatch(/ISS-123/);
    expect(text).toMatch(/Fix the thing/);
    expect(text).toMatch(/in_progress/);
    expect(text).toMatch(/assigned/);
    expect(text).toMatch(/paperclip\.example/);
    expect(text).toMatch(/Detailed description\./);
    expect(text).toMatch(/\/done/);
  });

  it("bodyOverride wins over the rendered template", () => {
    expect(
      renderIssueMessage({ issue, wakeReason: "x", bodyOverride: "raw text" }),
    ).toBe("raw text");
  });
});

describe("makeGchatChannel.send", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "spaces/AAA/messages/MMM.NNN",
          thread: { name: "spaces/AAA/threads/ISS-123" },
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

  it("calls Chat send with rendered body in the agent's space, threaded by issue.id", async () => {
    const ch = makeGchatChannel({ serviceAccount: SA, audience: AUDIENCE });
    const result = await ch.send({ agent, issue, wakeReason: "assigned" });
    expect(result.externalId).toBe("spaces/AAA/messages/MMM.NNN");
    expect(result.summary).toMatch(/Daniel/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("spaces/AAA/messages");
    expect(url).toContain("threadKey=ISS-123");
    const body = JSON.parse(init.body as string);
    expect(body.text).toMatch(/ISS-123/);
    expect(body.thread).toEqual({ threadKey: "ISS-123" });
  });

  it("throws if agent.channelConfig.gchatUserSpace is missing", async () => {
    const ch = makeGchatChannel({ serviceAccount: SA, audience: AUDIENCE });
    const naked: AgentRef = { ...agent, channelConfig: {} };
    await expect(
      ch.send({ agent: naked, issue, wakeReason: "assigned" }),
    ).rejects.toThrow(/gchatUserSpace not set/);
  });
});
