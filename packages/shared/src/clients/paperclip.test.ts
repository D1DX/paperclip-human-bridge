import { describe, expect, it, vi } from "vitest";
import { makePaperclipClient, PaperclipApiError } from "./paperclip.js";

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("paperclip client — URL composition + auth header", () => {
  it("getIssue → GET /api/issues/:id with bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: "ISS-1", title: "x", body: "y", status: "open", url: "u" }),
    );
    const c = makePaperclipClient({ baseUrl: "https://p.test", fetch: fetchMock });
    await c.getIssue("ISS-1", "key-abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://p.test/api/issues/ISS-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer key-abc" }),
      }),
    );
  });

  it("createComment → POST .../comments with JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "c1", body: "hi" }));
    const c = makePaperclipClient({ baseUrl: "https://p.test", fetch: fetchMock });
    await c.createComment("ISS-1", "hi", "k");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://p.test/api/issues/ISS-1/comments");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ body: "hi" });
  });

  it("createWorkProduct → POST .../work-products with full input", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "wp1", title: "t", body: "b" }));
    const c = makePaperclipClient({ baseUrl: "https://p.test", fetch: fetchMock });
    await c.createWorkProduct(
      "ISS-1",
      { title: "Done", body: "shipped", attachmentIds: ["a", "b"] },
      "k",
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({
      title: "Done",
      body: "shipped",
      attachmentIds: ["a", "b"],
    });
  });

  it("patchIssueStatus → PATCH .../issues/:id with {status}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: "ISS-1", title: "x", body: "y", status: "done", url: "u" }),
    );
    const c = makePaperclipClient({ baseUrl: "https://p.test", fetch: fetchMock });
    await c.patchIssueStatus("ISS-1", "done", "k");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://p.test/api/issues/ISS-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ status: "done" });
  });

  it("createInteraction → POST .../interactions with kind+body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "i1", kind: "question", body: "q" }));
    const c = makePaperclipClient({ baseUrl: "https://p.test", fetch: fetchMock });
    await c.createInteraction("ISS-1", { kind: "question", body: "q" }, "k");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://p.test/api/issues/ISS-1/interactions");
    expect(JSON.parse(init.body as string)).toEqual({ kind: "question", body: "q" });
  });

  it("respondInteraction → POST .../interactions/:id/responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "r1", kind: "response", body: "answer" }));
    const c = makePaperclipClient({ baseUrl: "https://p.test", fetch: fetchMock });
    await c.respondInteraction("INT-9", "answer", "k");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://p.test/api/interactions/INT-9/responses");
    expect(JSON.parse(init.body as string)).toEqual({ body: "answer" });
  });

  it("strips trailing slash from baseUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "ISS-1", title: "", body: "", status: "", url: "" }));
    const c = makePaperclipClient({ baseUrl: "https://p.test///", fetch: fetchMock });
    await c.getIssue("ISS-1", "k");
    expect(fetchMock.mock.calls[0][0]).toBe("https://p.test/api/issues/ISS-1");
  });
});

describe("paperclip client — errors", () => {
  it("4xx throws PaperclipApiError with status + body", async () => {
    // Fresh Response per call — body streams consume once.
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response("not found", { status: 404 }));
    const c = makePaperclipClient({ baseUrl: "https://p.test", fetch: fetchMock });
    await expect(c.getIssue("missing", "k")).rejects.toBeInstanceOf(PaperclipApiError);
    await expect(c.getIssue("missing", "k")).rejects.toMatchObject({
      status: 404,
      method: "GET",
      path: "/api/issues/missing",
    });
  });

  it("5xx throws PaperclipApiError too", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("boom", { status: 503 }),
    );
    const c = makePaperclipClient({ baseUrl: "https://p.test", fetch: fetchMock });
    await expect(c.createComment("ISS-1", "x", "k")).rejects.toThrow(/503/);
  });
});
