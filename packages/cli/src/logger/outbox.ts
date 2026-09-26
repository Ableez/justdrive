import fs from 'fs/promises';
import crypto from 'crypto';
import { getOutboxPath } from '../config/paths.js';

export type EventType =
  | 'upload'
  | 'download'
  | 'mkdir'
  | 'mv'
  | 'rm'
  | 'share'
  | 'send'
  | 'receive';

export interface OutboxEvent {
  id: string;
  type: EventType;
  path?: string;
  drive_file_id?: string;
  bytes?: number;
  status: 'success' | 'error';
  detail?: string;
  at: string;
}

const BATCH_SIZE = 200;
const MAX_QUEUE = 2000;

/**
 * Local read-modify-write of the queue is serialised. The lock is only ever
 * held for file IO, never across the network call.
 */
let chain: Promise<unknown> = Promise.resolve();

function serialise<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function read(): Promise<OutboxEvent[]> {
  let raw: string;
  try {
    raw = await fs.readFile(getOutboxPath(), 'utf-8');
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEvent[]) : [];
  } catch {
    // Truncated by a crash mid-write. Kept aside so it is not silently
    // overwritten, then treated as an empty queue.
    await fs.rename(getOutboxPath(), `${getOutboxPath()}.corrupt.${Date.now()}`).catch(() => {});
    return [];
  }
}

async function write(events: OutboxEvent[]): Promise<void> {
  const target = getOutboxPath();
  await fs.mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true });
  const temp = `${target}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(events, null, 2), { mode: 0o600 });
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}

export async function queueEvent(
  event: Omit<OutboxEvent, 'id' | 'at'> & Partial<Pick<OutboxEvent, 'id' | 'at'>>,
): Promise<OutboxEvent> {
  const entry: OutboxEvent = {
    ...event,
    id: event.id ?? crypto.randomUUID(),
    at: event.at ?? new Date().toISOString(),
  };

  return serialise(async () => {
    const events = await read();
    events.push(entry);
    await write(events.slice(-MAX_QUEUE));
    return entry;
  });
}

export async function pendingCount(): Promise<number> {
  return (await read()).length;
}

/**
 * Sends queued events and drops the ones the server accepted. Ids are generated
 * when the event is queued, so replaying after an outage updates the same rows
 * instead of duplicating history.
 */
export async function flush(): Promise<{ sent: number; remaining: number }> {
  const events = await read();
  if (events.length === 0) return { sent: 0, remaining: 0 };

  const { sendEvents } = await import('../api/events.js');
  const batch = events.slice(0, BATCH_SIZE);
  const accepted = await sendEvents(batch);

  if (!Number.isInteger(accepted) || accepted < 0 || accepted > batch.length) {
    throw new Error(`Server reported an unusable accepted count: ${accepted}`);
  }

  // A partial batch stays queued: the count says how many rows the server
  // stored, not which of ours they were.
  if (accepted < batch.length) return { sent: accepted, remaining: events.length };

  // Removed by id against the current queue rather than by slice, so anything
  // queued while the request was in flight survives.
  const acked = new Set(batch.map((event) => event.id));
  return serialise(async () => {
    const current = await read();
    await write(current.filter((event) => !acked.has(event.id)));
    return { sent: accepted, remaining: current.length - batch.length };
  });
}
