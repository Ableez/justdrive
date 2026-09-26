import type { OutboxEvent } from '../logger/outbox.js';
import { request } from './client.js';

/**
 * Sends a batch and reports how many the server stored. Replay is safe because
 * every event carries a client-generated id.
 */
export async function sendEvents(events: OutboxEvent[]): Promise<number> {
  if (events.length === 0) return 0;

  const body = await request<{ accepted: number }>('/api/cli/events', {
    method: 'POST',
    body: JSON.stringify({
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        path: event.path ?? null,
        drive_file_id: event.drive_file_id ?? null,
        bytes: event.bytes ?? null,
        status: event.status,
        detail: event.detail ?? null,
        at: event.at,
      })),
    }),
  });

  return body.accepted;
}
