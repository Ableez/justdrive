import { getDb } from '#/db/client';
import { requireDevice, toApiError } from '#/lib/api-guard';
import { recordEvents } from '#/lib/record-event';
import { securityHeaders } from '#/lib/request-security';
import { eventsRequestSchema } from '#/lib/schemas';

export async function POST(request: Request) {
  const db = getDb();

  try {
    const device = await requireDevice(request, db);
    const parsed = eventsRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return securityHeaders(Response.json({ error: 'Invalid request' }, { status: 400 }));

    const accepted = await recordEvents(
      db,
      { userId: device.userId, deviceId: device.deviceId, ip: device.ip },
      parsed.data.events.map((event) => ({
        id: event.id,
        type: event.type,
        path: event.path,
        driveFileId: event.drive_file_id,
        bytes: event.bytes,
        status: event.status,
        detail: event.detail,
        at: event.at,
      })),
    );

    return securityHeaders(Response.json({ accepted }));
  } catch (error) {
    return securityHeaders(toApiError(error));
  }
}

export const dynamic = 'force-dynamic';
