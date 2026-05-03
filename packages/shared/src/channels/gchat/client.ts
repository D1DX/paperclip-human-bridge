/**
 * Google Chat REST API client.
 *
 * Tiny surface — three methods used by the bridge:
 *   - sendDmMessage: post a message into a user's DM space (creating the
 *     space implicitly via `spaces/{user}` resolution if needed).
 *   - getUser: read display name + email for a Chat user resource name.
 *   - fetchAttachment: download an attachment payload by resource name.
 *
 * Auth: service-account JWT (subject = service account itself, not
 * domain-wide delegation — DM-to-user works because the Chat app is
 * installed in the user's space). google-auth-library handles the JWT
 * dance; native fetch handles the REST calls.
 */
import { JWT } from "google-auth-library";

const CHAT_BASE = "https://chat.googleapis.com/v1";
const SCOPES = [
  "https://www.googleapis.com/auth/chat.bot",
  "https://www.googleapis.com/auth/chat.messages",
];

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  [k: string]: unknown;
}

export interface SendDmResult {
  /** Chat resource name of the created message, e.g. `spaces/AAA/messages/BBB.CCC`. */
  messageName: string;
  /** Chat resource name of the thread, e.g. `spaces/AAA/threads/DDD`. */
  threadName: string;
}

export interface GchatUser {
  /** Display name as shown in Chat (e.g. "Daniel Rudaev"). */
  displayName: string;
  /** Workspace email if the API exposed it; `undefined` if not. */
  email?: string;
}

/**
 * Get a JWT-bearing fetch for Chat REST. Caches the token client-side
 * for its full TTL (google-auth-library handles refresh).
 */
function makeAuth(sa: ServiceAccountKey): JWT {
  return new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: SCOPES,
  });
}

async function authedFetch(
  jwt: JWT,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await jwt.getAccessToken();
  if (!token.token) {
    throw new Error(
      "[gchat client] google-auth-library returned no access token — check service account key.",
    );
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token.token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(url, { ...init, headers });
}

/**
 * Send a DM. `gchatUserSpace` is a Chat space resource name for the
 * 1:1 conversation — caller resolves it (typically `spaces/{spaceId}`).
 * For first-message-to-a-user flows where the space ID is unknown, see
 * `findOrCreateDmSpace` (planned for Phase 5; v0.1 expects callers to
 * pre-resolve via the agent's `gchatUserId` config — Chat returns the
 * space ID from a previous send and the responder caches it).
 *
 * `threadKey` lets the message be a reply in an existing thread.
 * Omit it to start a new thread.
 */
export async function sendDmMessage(
  sa: ServiceAccountKey,
  gchatUserSpace: string,
  text: string,
  threadKey?: string,
): Promise<SendDmResult> {
  const jwt = makeAuth(sa);
  const url = new URL(`${CHAT_BASE}/${gchatUserSpace}/messages`);
  if (threadKey) {
    url.searchParams.set("messageReplyOption", "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
    url.searchParams.set("threadKey", threadKey);
  }
  const body: Record<string, unknown> = { text };
  if (threadKey) {
    body.thread = { threadKey };
  }
  const res = await authedFetch(jwt, url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `[gchat client] sendDmMessage failed: ${res.status} ${res.statusText} — ${errBody.slice(0, 500)}`,
    );
  }
  const json = (await res.json()) as { name?: string; thread?: { name?: string } };
  if (!json.name || !json.thread?.name) {
    throw new Error(
      `[gchat client] sendDmMessage response missing name/thread.name: ${JSON.stringify(json).slice(0, 500)}`,
    );
  }
  return { messageName: json.name, threadName: json.thread.name };
}

/**
 * Get user profile by Chat user resource name (e.g. `users/12345`).
 * Display name is always present; email depends on Workspace privacy
 * settings.
 */
export async function getUser(
  sa: ServiceAccountKey,
  gchatUserId: string,
): Promise<GchatUser> {
  const jwt = makeAuth(sa);
  const res = await authedFetch(jwt, `${CHAT_BASE}/${gchatUserId}`);
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `[gchat client] getUser failed: ${res.status} ${res.statusText} — ${errBody.slice(0, 500)}`,
    );
  }
  const json = (await res.json()) as { displayName?: string; email?: string };
  if (!json.displayName) {
    throw new Error(
      `[gchat client] getUser response missing displayName for ${gchatUserId}: ${JSON.stringify(json).slice(0, 500)}`,
    );
  }
  return { displayName: json.displayName, email: json.email };
}

/**
 * Download an attachment by its Chat resource name (e.g.
 * `spaces/AAA/messages/BBB/attachments/CCC`). Returns the raw bytes.
 */
export async function fetchAttachment(
  sa: ServiceAccountKey,
  attachmentName: string,
): Promise<Buffer> {
  const jwt = makeAuth(sa);
  const url = `${CHAT_BASE}/media/${encodeURIComponent(attachmentName)}?alt=media`;
  const res = await authedFetch(jwt, url, {
    headers: { Accept: "*/*" },
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `[gchat client] fetchAttachment failed: ${res.status} ${res.statusText} — ${errBody.slice(0, 500)}`,
    );
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
