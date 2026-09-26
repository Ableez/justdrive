import { and, asc, eq, isNull } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { devices } from '#/db/schema';
import { requireDevice, toApiError } from '#/lib/api-guard';
import { securityHeaders } from '#/lib/request-security';

export async function GET(request: Request) {
  const db = getDb();
  try {
    const device = await requireDevice(request, db);
    const rows = await db
      .select({ id: devices.id, name: devices.name, lastSeenAt: devices.lastSeenAt })
      .from(devices)
      .where(and(eq(devices.userId, device.userId), isNull(devices.revokedAt)))
      .orderBy(asc(devices.name));

    return securityHeaders(
      Response.json({
        devices: rows.map((row) => ({
          id: row.id,
          name: row.name,
          last_seen_at: row.lastSeenAt?.toISOString() ?? null,
          is_self: row.id === device.deviceId,
        })),
      }),
    );
  } catch (error) {
    return securityHeaders(toApiError(error));
  }
}

export const dynamic = 'force-dynamic';
