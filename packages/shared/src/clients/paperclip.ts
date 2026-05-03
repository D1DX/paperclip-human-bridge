/**
 * Paperclip REST client used by the responder to act AS an agent.
 *
 * Auth model: per-call `agentApiKey` (one `agent_api_keys` row per
 * human agent, per decisions.md row 11 — never a board key). The
 * caller resolves the key from the agent record + 1Password before
 * invoking these methods.
 *
 * Surface is intentionally narrow — six methods covering the v1 slash
 * grammar's REST footprint:
 *
 *   - getIssue           — read context for the active thread
 *   - createComment      — free-text path
 *   - createWorkProduct  — `/done` and attachment paths
 *   - patchIssueStatus   — `/done` (status=done) and `/block` (status=blocked)
 *   - createInteraction  — `/q` path (escalates to assigner)
 *   - respondInteraction — when the assigner replies, the agent's
 *                          counter-reply lands as an interaction response
 *
 * Errors: 4xx/5xx throw `PaperclipApiError` with status + body
 * preserved for diagnostics. No retries — caller decides.
 */

export interface PaperclipClientConfig {
  /** Base URL, no trailing slash. e.g. `https://paperclip.example`. */
  baseUrl: string;
  /** Optional fetch override for tests / non-Node runtimes. */
  fetch?: typeof fetch;
}

export class PaperclipApiError extends Error {
  constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(
      `[paperclip] ${method} ${path} → ${status}: ${body.slice(0, 500)}`,
    );
    this.name = "PaperclipApiError";
  }
}

export interface IssueRecord {
  id: string;
  title: string;
  body: string;
  status: string;
  url: string;
  [k: string]: unknown;
}

export interface CommentRecord {
  id: string;
  body: string;
  [k: string]: unknown;
}

export interface WorkProductRecord {
  id: string;
  title: string;
  body: string;
  [k: string]: unknown;
}

export interface InteractionRecord {
  id: string;
  kind: string;
  body: string;
  [k: string]: unknown;
}

export interface CreateWorkProductInput {
  title: string;
  body: string;
  /** Paperclip attachment IDs already uploaded via the file-upload endpoint. */
  attachmentIds?: string[];
}

export interface CreateInteractionInput {
  /** Paperclip interaction kind, e.g. "question". */
  kind: string;
  body: string;
}

export function makePaperclipClient(config: PaperclipClientConfig) {
  const base = config.baseUrl.replace(/\/+$/, "");
  const fetchFn = config.fetch ?? fetch;

  async function call<T>(
    method: string,
    path: string,
    agentApiKey: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${agentApiKey}`,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetchFn(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new PaperclipApiError(method, path, res.status, text);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    getIssue(issueId: string, agentApiKey: string): Promise<IssueRecord> {
      return call("GET", `/api/issues/${encodeURIComponent(issueId)}`, agentApiKey);
    },

    createComment(
      issueId: string,
      body: string,
      agentApiKey: string,
    ): Promise<CommentRecord> {
      return call(
        "POST",
        `/api/issues/${encodeURIComponent(issueId)}/comments`,
        agentApiKey,
        { body },
      );
    },

    createWorkProduct(
      issueId: string,
      input: CreateWorkProductInput,
      agentApiKey: string,
    ): Promise<WorkProductRecord> {
      return call(
        "POST",
        `/api/issues/${encodeURIComponent(issueId)}/work-products`,
        agentApiKey,
        input,
      );
    },

    patchIssueStatus(
      issueId: string,
      status: string,
      agentApiKey: string,
    ): Promise<IssueRecord> {
      return call(
        "PATCH",
        `/api/issues/${encodeURIComponent(issueId)}`,
        agentApiKey,
        { status },
      );
    },

    createInteraction(
      issueId: string,
      input: CreateInteractionInput,
      agentApiKey: string,
    ): Promise<InteractionRecord> {
      return call(
        "POST",
        `/api/issues/${encodeURIComponent(issueId)}/interactions`,
        agentApiKey,
        input,
      );
    },

    respondInteraction(
      interactionId: string,
      body: string,
      agentApiKey: string,
    ): Promise<InteractionRecord> {
      return call(
        "POST",
        `/api/interactions/${encodeURIComponent(interactionId)}/responses`,
        agentApiKey,
        { body },
      );
    },
  };
}

export type PaperclipClient = ReturnType<typeof makePaperclipClient>;
