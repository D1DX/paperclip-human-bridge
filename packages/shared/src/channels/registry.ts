/**
 * Channel registry — pluggable interface for human-agent channels.
 *
 * Each channel module (`gchat`, `telegram`, `slack`, `whatsapp`, `email`)
 * exports a `Channel` implementation registered here. The adapter and
 * responder dispatch by `Channel.id` looked up against `agent.adapterConfig.channel`.
 *
 * v0.1: only `gchat` ships with real code. Other channels are placeholder
 * modules that throw `not implemented` if used — a deliberate fail-loud
 * default so misconfigured installs don't silently drop messages.
 */

import type { AgentRef, IssueContext, CommandResult } from "../types.js";

/**
 * Outbound: adapter calls this when Paperclip assigns/wakes the agent.
 * Implementation sends a message in the channel and returns a tracking ID.
 */
export interface ChannelSendCtx {
  agent: AgentRef;
  issue: IssueContext;
  /** Reason Paperclip woke the agent: "assigned" | "interaction_response" | "wakeup" | ... */
  wakeReason: string;
  /** Optional message body override (e.g. interaction-response forwarding). */
  bodyOverride?: string;
}

export interface ChannelSendResult {
  /** Channel-native message/thread identifier for state correlation. */
  externalId: string;
  /** Human-readable summary for the adapter execute() return. */
  summary: string;
}

/**
 * Inbound: responder calls this when an event arrives on the channel's
 * webhook. Implementation parses the channel-native event into a
 * neutral `CommandResult` the responder turns into Paperclip REST calls.
 */
export interface ChannelInboundEvent {
  /** Raw request — channel-specific shape; implementation does its own parsing. */
  request: Request;
}

export interface ChannelInboundResult {
  /** External user identifier (channel-native ID) — used to look up agent. */
  senderExternalId: string;
  /** Channel-native thread/conversation ID (for active-issue resolution). */
  threadExternalId: string;
  /** Parsed slash-command result. */
  command: CommandResult;
  /** Reply hook the responder calls to confirm in-channel. */
  replyInChannel: (text: string) => Promise<void>;
}

/**
 * The implementation contract every channel module must satisfy.
 */
export interface Channel {
  /** Stable channel ID — matches `agents[].channel` in config. */
  id: "gchat" | "telegram" | "slack" | "whatsapp" | "email";

  /** Human-readable name for UIs and logs. */
  displayName: string;

  /** Send an outbound message (adapter execute path). */
  send(ctx: ChannelSendCtx): Promise<ChannelSendResult>;

  /**
   * Verify channel-native auth on an inbound event request and parse it
   * to a neutral inbound result. Throws on auth failure.
   */
  parseInboundEvent(evt: ChannelInboundEvent): Promise<ChannelInboundResult>;
}

const REGISTRY = new Map<Channel["id"], Channel>();

export function registerChannel(channel: Channel): void {
  if (REGISTRY.has(channel.id)) {
    throw new Error(
      `Channel "${channel.id}" already registered. Re-registration is a bug.`,
    );
  }
  REGISTRY.set(channel.id, channel);
}

export function getChannel(id: Channel["id"]): Channel {
  const c = REGISTRY.get(id);
  if (!c) {
    throw new Error(
      `Channel "${id}" is not registered. Known: ${[...REGISTRY.keys()].join(", ") || "(none)"}.`,
    );
  }
  return c;
}

export function listChannels(): Channel["id"][] {
  return [...REGISTRY.keys()];
}

export function isChannelRegistered(id: string): boolean {
  return REGISTRY.has(id as Channel["id"]);
}
