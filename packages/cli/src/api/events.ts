import type { OutboxEvent } from '../logger/outbox.js';
import { requireSession } from './client.js';

export async function sendEvents(events: OutboxEvent[]): Promise<number> {
  if (events.length === 0) return 0;

  const session = await requireSession();
  const response = await fetch(`${session.apiUrl.replace(/\/+$/, '')}/api/cli/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
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

  if (!response.ok) throw new Error(`Event upload failed (${response.status})`);
  const body = (await response.json()) as { accepted: number };
  return body.accepted;
}
