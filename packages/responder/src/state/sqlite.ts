/**
 * SQLite-backed ThreadStore — production impl for the Coolify deploy
 * target.
 *
 * Uses better-sqlite3 (sync API) — fine here because the responder's
 * Hono runtime is Node and each request only does a handful of point
 * lookups; the sync calls don't block long enough to matter, and the
 * lack of a connection pool simplifies things.
 *
 * Schema (per decisions.md row 36):
 *
 *   CREATE TABLE thread_state (
 *     channel TEXT NOT NULL,
 *     external_thread_id TEXT NOT NULL,
 *     agent_id TEXT NOT NULL,
 *     active_issue_id TEXT NOT NULL,
 *     started_at INTEGER NOT NULL,
 *     last_activity_at INTEGER NOT NULL,
 *     PRIMARY KEY (channel, external_thread_id)
 *   );
 *
 * For Worker / D1 deploys, write a `D1ThreadStore` against the same
 * `ThreadStore` interface — schema is identical.
 */
import Database from "better-sqlite3";
import type { ThreadRecord, ThreadStore } from "./thread-state.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS thread_state (
  channel TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  active_issue_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  PRIMARY KEY (channel, external_thread_id)
);
`;

interface Row {
  channel: string;
  external_thread_id: string;
  agent_id: string;
  active_issue_id: string;
  started_at: number;
  last_activity_at: number;
}

export interface SqliteThreadStoreOptions {
  /** Filesystem path. Use ":memory:" for ephemeral. */
  path: string;
}

export class SqliteThreadStore implements ThreadStore {
  private readonly db: Database.Database;
  private readonly stmts: {
    get: Database.Statement;
    upsert: Database.Statement;
    touch: Database.Statement;
  };

  constructor(opts: SqliteThreadStoreOptions) {
    this.db = new Database(opts.path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
    this.stmts = {
      get: this.db.prepare(
        "SELECT * FROM thread_state WHERE channel = ? AND external_thread_id = ?",
      ),
      upsert: this.db.prepare(
        `INSERT INTO thread_state
           (channel, external_thread_id, agent_id, active_issue_id, started_at, last_activity_at)
         VALUES (@channel, @externalThreadId, @agentId, @activeIssueId, @startedAt, @lastActivityAt)
         ON CONFLICT(channel, external_thread_id) DO UPDATE SET
           agent_id = excluded.agent_id,
           active_issue_id = excluded.active_issue_id,
           last_activity_at = excluded.last_activity_at`,
      ),
      touch: this.db.prepare(
        "UPDATE thread_state SET last_activity_at = ? WHERE channel = ? AND external_thread_id = ?",
      ),
    };
  }

  async get(channel: string, externalThreadId: string): Promise<ThreadRecord | null> {
    const row = this.stmts.get.get(channel, externalThreadId) as Row | undefined;
    if (!row) return null;
    return rowToRecord(row);
  }

  async upsert(
    record: Omit<ThreadRecord, "startedAt" | "lastActivityAt"> & {
      startedAt?: number;
      lastActivityAt?: number;
    },
  ): Promise<void> {
    const now = Date.now();
    // Preserve startedAt across rebinds: read before write.
    const existing = this.stmts.get.get(record.channel, record.externalThreadId) as
      | Row
      | undefined;
    const startedAt = record.startedAt ?? existing?.started_at ?? now;
    this.stmts.upsert.run({
      channel: record.channel,
      externalThreadId: record.externalThreadId,
      agentId: record.agentId,
      activeIssueId: record.activeIssueId,
      startedAt,
      lastActivityAt: record.lastActivityAt ?? now,
    });
  }

  async touch(channel: string, externalThreadId: string): Promise<void> {
    this.stmts.touch.run(Date.now(), channel, externalThreadId);
  }

  /** Close the underlying handle. Call on shutdown. */
  close(): void {
    this.db.close();
  }
}

function rowToRecord(r: Row): ThreadRecord {
  return {
    channel: r.channel,
    externalThreadId: r.external_thread_id,
    agentId: r.agent_id,
    activeIssueId: r.active_issue_id,
    startedAt: r.started_at,
    lastActivityAt: r.last_activity_at,
  };
}
