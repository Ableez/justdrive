import { getDb } from '#/db/client';
import { devices } from '#/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { requireDevice, toApiError } from '#/lib/api-guard';
import { revokeDeviceTokens } from '#/lib/device-tokens';
import { recordServerEvent } from '#/lib/record-event';
import { securityHeaders } from '#/lib/request-security';

export async function POST(request: Request) {
  const db = getDb();
  try {
    const device = await requireDevice(request, db);

    await db
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(and(eq(devices.id, device.deviceId), isNull(devices.revokedAt)));
    await revokeDeviceTokens(db, device.deviceId);
    await recordServerEvent(db, {
      userId: device.userId,
      deviceId: device.deviceId,
      type: 'device_revoked',
      detail: device.deviceName,
    });

    return securityHeaders(Response.json({ ok: true }));
  } catch (error) {
    return securityHeaders(toApiError(error));
  }
}

export const dynamic = 'force-dynamic';
