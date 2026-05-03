/**
 * Google Chat event parser.
 *
 * Verifies the inbound request's OIDC JWT (Google retired the
 * `X-Verification-Token` model in 2024; every Chat event now arrives
 * with a Google-signed JWT in `Authorization: Bearer <token>` whose
 * `iss` is `chat@system.gserviceaccount.com` and whose `aud` matches
 * the value configured in the Chat API "Connection settings" → "App URL"
 * (or the bot's project number, depending on the configured
 * authentication audience).
 *
 * After auth, extracts sender/thread/message from the JSON body, runs
 * the channel-neutral command parser, and returns a
 * `ChannelInboundResult` the responder turns into Paperclip REST calls.
 *
 * The `replyInChannel` closure captures the service account JSON +
 * thread name so the responder can call it without knowing Chat
 * internals.
 *
 * Event shape reference:
 * https://developers.google.com/workspace/chat/api/reference/rest/v1/Event
 * Auth reference:
 * https://developers.google.com/workspace/chat/authenticate-authorize-chat-app
 */
import { OAuth2Client } from "google-auth-library";
import { parseCommand } from "../../commands.js";
import type {
  ChannelInboundEvent,
  ChannelInboundResult,
} from "../registry.js";
import { sendDmMessage, type ServiceAccountKey } from "./client.js";

const CHAT_ISSUER = "chat@system.gserviceaccount.com";

interface ChatMessageEvent {
  type?: string; // "MESSAGE" | "ADDED_TO_SPACE" | ...
  user?: { name?: string; displayName?: string };
  space?: { name?: string };
  message?: {
    name?: string;
    text?: string;
    thread?: { name?: string };
    attachment?: Array<{ name?: string; contentName?: string }>;
  };
}

export interface GchatParserDeps {
  /** Loaded service account JSON; used by the reply closure. */
  serviceAccount: ServiceAccountKey;
  /**
   * Expected JWT `aud` claim. Set to the value configured in the Chat
   * API "Authentication audience" — typically the responder's public
   * URL (e.g. `https://human-bridge.example.com`) or the bot's GCP
   * project number as a string.
   */
  audience: string;
  /**
   * Optional OAuth2Client override for tests. Production omits this and
   * the parser builds its own `new OAuth2Client()`.
   */
  oauth2Client?: Pick<OAuth2Client, "verifyIdToken">;
}

/**
 * Build a parser bound to a service account + expected audience.
 * The returned function matches the `Channel.parseInboundEvent`
 * signature.
 */
export function makeGchatParser(deps: GchatParserDeps) {
  const verifier = deps.oauth2Client ?? new OAuth2Client();

  return async function parseGchatEvent(
    evt: ChannelInboundEvent,
  ): Promise<ChannelInboundResult> {
    const authHeader = evt.request.headers.get("Authorization");
    if (!authHeader) {
      throw new Error(
        "[gchat parser] missing Authorization header — request rejected.",
      );
    }
    const m = authHeader.match(/^Bearer\b(.*)$/i);
    if (!m) {
      throw new Error(
        "[gchat parser] Authorization header is not a Bearer token — request rejected.",
      );
    }
    const idToken = (m[1] ?? "").trim();
    if (!idToken) {
      throw new Error(
        "[gchat parser] Authorization Bearer token is empty — request rejected.",
      );
    }

    let payload: { iss?: string; aud?: string | string[]; email?: string } | undefined;
    try {
      const ticket = await verifier.verifyIdToken({
        idToken,
        audience: deps.audience,
      });
      payload = ticket.getPayload();
    } catch (e) {
      throw new Error(
        `[gchat parser] OIDC JWT verification failed: ${(e as Error).message}`,
      );
    }
    if (!payload) {
      throw new Error(
        "[gchat parser] OIDC JWT had no payload — request rejected.",
      );
    }
    if (payload.iss !== CHAT_ISSUER) {
      throw new Error(
        `[gchat parser] OIDC JWT iss "${payload.iss}" is not ${CHAT_ISSUER} — request rejected.`,
      );
    }
    // verifyIdToken already checks `aud`, but assert defensively in case
    // the lib's contract changes.
    const aud = payload.aud;
    const audMatches = Array.isArray(aud)
      ? aud.includes(deps.audience)
      : aud === deps.audience;
    if (!audMatches) {
      throw new Error(
        `[gchat parser] OIDC JWT aud "${String(aud)}" does not match expected "${deps.audience}".`,
      );
    }

    const body = (await evt.request.json()) as ChatMessageEvent;

    if (body.type && body.type !== "MESSAGE") {
      throw new Error(
        `[gchat parser] event type "${body.type}" not supported in v0.1 (only MESSAGE).`,
      );
    }

    const senderExternalId = body.user?.name;
    const spaceName = body.space?.name;
    const threadExternalId = body.message?.thread?.name;
    const messageText = body.message?.text ?? "";
    const attachmentRefs = (body.message?.attachment ?? [])
      .map((a) => a.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);

    if (!senderExternalId) {
      throw new Error("[gchat parser] event missing user.name (sender id).");
    }
    if (!spaceName) {
      throw new Error("[gchat parser] event missing space.name.");
    }
    if (!threadExternalId) {
      throw new Error("[gchat parser] event missing message.thread.name.");
    }

    const command = parseCommand({ text: messageText, attachmentRefs });

    // The reply closure sends back into the SAME thread.
    // threadKey = thread resource name's last segment (Chat uses the
    // bare thread name as the reply key).
    const threadKeyMatch = threadExternalId.match(/threads\/([^/]+)$/);
    const threadKey = threadKeyMatch?.[1];

    const replyInChannel = async (text: string) => {
      await sendDmMessage(deps.serviceAccount, spaceName, text, threadKey);
    };

    return {
      senderExternalId,
      threadExternalId,
      command,
      replyInChannel,
    };
  };
}
