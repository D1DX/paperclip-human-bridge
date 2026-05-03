import { describe, expect, it } from "vitest";
import { parseCommand, HELP_TEXT } from "./commands.js";

describe("parseCommand — free text path", () => {
  it("plain text → comment", () => {
    expect(parseCommand({ text: "I'm on it" })).toEqual({
      kind: "comment",
      body: "I'm on it",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseCommand({ text: "   hello   " })).toEqual({
      kind: "comment",
      body: "hello",
    });
  });

  it("text + attachments → attachment kind", () => {
    expect(
      parseCommand({
        text: "Here is the screenshot",
        attachmentRefs: ["spaces/AAA/messages/MMM/attachments/CCC"],
      }),
    ).toEqual({
      kind: "attachment",
      body: "Here is the screenshot",
      attachmentRefs: ["spaces/AAA/messages/MMM/attachments/CCC"],
    });
  });

  it("attachments only (no text) → attachment kind with empty body", () => {
    expect(
      parseCommand({ text: "", attachmentRefs: ["att-1", "att-2"] }),
    ).toEqual({
      kind: "attachment",
      body: "",
      attachmentRefs: ["att-1", "att-2"],
    });
  });

  it("empty text, no attachments → unknown", () => {
    expect(parseCommand({ text: "" })).toEqual({ kind: "unknown", raw: "" });
  });
});

describe("parseCommand — /done", () => {
  it("/done bare → done without summary", () => {
    expect(parseCommand({ text: "/done" })).toEqual({ kind: "done" });
  });

  it("/done with summary → done with summary", () => {
    expect(parseCommand({ text: "/done deployed to prod" })).toEqual({
      kind: "done",
      summary: "deployed to prod",
    });
  });

  it("/Done case-insensitive", () => {
    expect(parseCommand({ text: "/Done" })).toEqual({ kind: "done" });
  });

  it("trailing whitespace in summary is trimmed", () => {
    expect(parseCommand({ text: "/done  shipped  " })).toEqual({
      kind: "done",
      summary: "shipped",
    });
  });
});

describe("parseCommand — /block", () => {
  it("/block <reason> → block", () => {
    expect(parseCommand({ text: "/block waiting on API key" })).toEqual({
      kind: "block",
      reason: "waiting on API key",
    });
  });

  it("/block without reason → unknown (reason required)", () => {
    expect(parseCommand({ text: "/block" })).toEqual({
      kind: "unknown",
      raw: "/block",
    });
  });
});

describe("parseCommand — /q (question)", () => {
  it("/q <question> → question", () => {
    expect(parseCommand({ text: "/q which env should I use?" })).toEqual({
      kind: "question",
      body: "which env should I use?",
    });
  });

  it("/question alias", () => {
    expect(parseCommand({ text: "/question is this blocking?" })).toEqual({
      kind: "question",
      body: "is this blocking?",
    });
  });

  it("/q without body → unknown", () => {
    expect(parseCommand({ text: "/q" })).toEqual({
      kind: "unknown",
      raw: "/q",
    });
  });
});

describe("parseCommand — /help and unknown", () => {
  it("/help → help kind (no body)", () => {
    expect(parseCommand({ text: "/help" })).toEqual({ kind: "help" });
  });

  it("HELP_TEXT mentions every command", () => {
    expect(HELP_TEXT).toMatch(/\/done/);
    expect(HELP_TEXT).toMatch(/\/block/);
    expect(HELP_TEXT).toMatch(/\/q/);
    expect(HELP_TEXT).toMatch(/\/help/);
  });

  it("unknown slash command → unknown with raw", () => {
    expect(parseCommand({ text: "/release main" })).toEqual({
      kind: "unknown",
      raw: "/release main",
    });
  });

  it("multiline body in /q is preserved", () => {
    expect(parseCommand({ text: "/q line1\nline2\nline3" })).toEqual({
      kind: "question",
      body: "line1\nline2\nline3",
    });
  });
});
