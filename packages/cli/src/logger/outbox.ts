import fs from 'fs/promises';
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

async function read(): Promise<OutboxEvent[]> {
  try {
    return JSON.parse(await fs.readFile(getOutboxPath(), 'utf-8')) as OutboxEvent[];
  } catch {
    return [];
  }
}

async function write(events: OutboxEvent[]): Promise<void> {
  const path = getOutboxPath();
  await fs.mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  await fs.writeFile(path, JSON.stringify(events, null, 2));
}

export async function queueEvent(
  event: Omit<OutboxEvent, 'id' | 'at'> & Partial<Pick<OutboxEvent, 'id' | 'at'>>,
): Promise<OutboxEvent> {
  const entry: OutboxEvent = {
    ...event,
    id: event.id ?? crypto.randomUUID(),
    at: event.at ?? new Date().toISOString(),
  };
  const events = await read();
  events.push(entry);
  await write(events.slice(-2000));
  return entry;
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

  const remaining = events.slice(accepted);
  await write(remaining);
  return { sent: accepted, remaining: remaining.length };
}
