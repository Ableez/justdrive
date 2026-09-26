import { randomUUID } from 'node:crypto';
import type { Database } from '../db/client';
import { events, type EventType } from '../db/schema';

const INT4_MAX = 2_147_483_647;

export interface ReportedEvent {
  id?: string;
  type: EventType;
  path?: string | null;
  driveFileId?: string | null;
  bytes?: number | null;
  status?: string | null;
  detail?: string | null;
  at?: string;
}

export interface RecordContext {
  userId: string;
  deviceId: string | null;
  ip: string | null;
}

const MAX_TIMESTAMP_DRIFT_MS = 30 * 86_400_000;

/**
 * Client ids are accepted verbatim so a batch replayed after being offline
 * lands as an update rather than a duplicate row.
 */
export async function recordEvents(
  db: Database,
  context: RecordContext,
  reported: ReportedEvent[],
): Promise<number> {
  if (reported.length === 0) return 0;

  const rows = reported.map((event) => ({
    id: event.id || randomUUID(),
    userId: context.userId,
    deviceId: context.deviceId,
    type: event.type,
    path: event.path?.slice(0, 1024) ?? null,
    driveFileId: event.driveFileId?.slice(0, 128) ?? null,
    bytes: typeof event.bytes === 'number' ? Math.min(Math.trunc(event.bytes), INT4_MAX) : null,
    status: event.status?.slice(0, 32) ?? null,
    detail: event.detail?.slice(0, 500) ?? null,
    ip: context.ip,
    at: clampTimestamp(event.at),
  }));

  const inserted = await db
    .insert(events)
    .values(rows)
    .onConflictDoNothing({ target: events.id })
    .returning({ id: events.id });

  return inserted.length;
}

/**
 * A reported time far from the server's is replaced, so a device cannot bury
 * real history under future-dated rows in the activity feed.
 */
function clampTimestamp(value: string | undefined): Date {
  const now = Date.now();
  if (!value) return new Date(now);
  const reported = new Date(value).getTime();
  if (!Number.isFinite(reported)) return new Date(now);
  return Math.abs(reported - now) <= MAX_TIMESTAMP_DRIFT_MS ? new Date(reported) : new Date(now);
}

export async function recordServerEvent(
  db: Database,
  context: Omit<RecordContext, 'ip'> & { type: EventType; detail?: string; ip?: string | null },
): Promise<void> {
  await db.insert(events).values({
    id: randomUUID(),
    userId: context.userId,
    deviceId: context.deviceId,
    type: context.type,
    detail: context.detail?.slice(0, 500) ?? null,
    ip: context.ip ?? null,
  });
}
