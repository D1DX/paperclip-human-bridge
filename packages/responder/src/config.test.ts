import { describe, expect, it } from "vitest";
import { parseResponderConfig } from "./config.js";

const validYaml = `
agents:
  - id: agent-daniel
    name: Daniel
    role: engineer
    channel: gchat
    channelConfig:
      gchatUserId: users/123
      gchatUserSpace: spaces/AAA
    apiKeyEnv: PAPERCLIP_AGENT_DANIEL
  - id: agent-wannapa
    name: Wannapa
    channel: gchat
    channelConfig:
      gchatUserId: users/456
    apiKeyEnv: PAPERCLIP_AGENT_WANNAPA
`;

describe("parseResponderConfig", () => {
  it("parses a valid config with multiple agents", () => {
    const cfg = parseResponderConfig(validYaml);
    expect(cfg.agents).toHaveLength(2);
    expect(cfg.agents[0]).toMatchObject({
      id: "agent-daniel",
      name: "Daniel",
      role: "engineer",
      channel: "gchat",
      apiKeyEnv: "PAPERCLIP_AGENT_DANIEL",
    });
    expect(cfg.agents[0].channelConfig).toEqual({
      gchatUserId: "users/123",
      gchatUserSpace: "spaces/AAA",
    });
  });

  it("accepts agents without role", () => {
    const cfg = parseResponderConfig(validYaml);
    expect(cfg.agents[1].role).toBeUndefined();
  });

  it("rejects unknown channel", () => {
    const yaml = `
agents:
  - id: a
    name: x
    channel: discord
    channelConfig: {}
    apiKeyEnv: X
`;
    expect(() => parseResponderConfig(yaml)).toThrow(/schema validation/);
  });

  it("rejects lowercase apiKeyEnv", () => {
    const yaml = `
agents:
  - id: a
    name: x
    channel: gchat
    channelConfig: {}
    apiKeyEnv: paperclip_agent_x
`;
    expect(() => parseResponderConfig(yaml)).toThrow(/UPPER_SNAKE/);
  });

  it("rejects duplicate agent ids", () => {
    const yaml = `
agents:
  - id: dup
    name: A
    channel: gchat
    channelConfig: {}
    apiKeyEnv: KA
  - id: dup
    name: B
    channel: gchat
    channelConfig: {}
    apiKeyEnv: KB
`;
    expect(() => parseResponderConfig(yaml)).toThrow(/duplicate agent id: dup/);
  });

  it("rejects malformed YAML", () => {
    expect(() => parseResponderConfig("agents: [\n  - id: x\n  this isn't valid")).toThrow(
      /YAML parse failed/,
    );
  });

  it("accepts empty agents list", () => {
    const cfg = parseResponderConfig("agents: []");
    expect(cfg.agents).toEqual([]);
  });
});
