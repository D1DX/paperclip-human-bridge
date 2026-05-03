/**
 * Thread-state store — maps (channel, external_thread_id) → active issue.
 *
 * v0.1 ships an InMemoryThreadStore for tests + dev. Production deploys
 * back this with SQLite (Coolify) or D1 (Worker). Both implementations
 * satisfy the same `ThreadStore` interface.
 *
 * Schema (per decisions.md row 36):
 *   thread_state(channel, external_thread_id, agent_id, active_issue_id,
 *                started_at, last_activity_at)
 *   PRIMARY KEY (channel, external_thread_id)
 */

export interface ThreadRecord {
  channel: string;
  externalThreadId: string;
  agentId: string;
  activeIssueId: string;
  startedAt: number;
  lastActivityAt: number;
}

export interface ThreadStore {
  get(channel: string, externalThreadId: string): Promise<ThreadRecord | null>;
  /**
   * Bind (or rebind) a thread to an issue. Idempotent — overwriting the
   * active issue is the v1 behavior because one DM thread holds one
   * active issue at a time (decisions.md row 13).
   */
  upsert(record: Omit<ThreadRecord, "startedAt" | "lastActivityAt"> & {
    startedAt?: number;
    lastActivityAt?: number;
  }): Promise<void>;
  /** Touch lastActivityAt on a known thread; no-op if missing. */
  touch(channel: string, externalThreadId: string): Promise<void>;
}

export class InMemoryThreadStore implements ThreadStore {
  private readonly map = new Map<string, ThreadRecord>();

  private key(channel: string, externalThreadId: string): string {
    return `${channel}::${externalThreadId}`;
  }

  async get(channel: string, externalThreadId: string): Promise<ThreadRecord | null> {
    return this.map.get(this.key(channel, externalThreadId)) ?? null;
  }

  async upsert(
    record: Omit<ThreadRecord, "startedAt" | "lastActivityAt"> & {
      startedAt?: number;
      lastActivityAt?: number;
    },
  ): Promise<void> {
    const k = this.key(record.channel, record.externalThreadId);
    const prev = this.map.get(k);
    const now = Date.now();
    this.map.set(k, {
      channel: record.channel,
      externalThreadId: record.externalThreadId,
      agentId: record.agentId,
      activeIssueId: record.activeIssueId,
      startedAt: record.startedAt ?? prev?.startedAt ?? now,
      lastActivityAt: record.lastActivityAt ?? now,
    });
  }

  async touch(channel: string, externalThreadId: string): Promise<void> {
    const k = this.key(channel, externalThreadId);
    const rec = this.map.get(k);
    if (rec) rec.lastActivityAt = Date.now();
  }
}
