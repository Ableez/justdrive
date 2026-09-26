import { and, eq } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { transfers } from '#/db/schema';
import { ApiError, requireDevice, toApiError } from '#/lib/api-guard';
import { recordServerEvent } from '#/lib/record-event';
import { securityHeaders } from '#/lib/request-security';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const db = getDb();
  try {
    const device = await requireDevice(request, db);
    const { id } = await params;
    const updated = await db
      .update(transfers)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        ackedByDeviceId: device.deviceId,
      })
      .where(
        and(
          eq(transfers.id, id),
          eq(transfers.userId, device.userId),
          eq(transfers.toDeviceId, device.deviceId),
          eq(transfers.status, 'pending'),
        ),
      )
      .returning({ id: transfers.id, fromDeviceId: transfers.fromDeviceId });

    if (updated.length === 0) throw new ApiError('No pending transfer with that id', 404);

    await recordServerEvent(db, {
      userId: device.userId,
      deviceId: device.deviceId,
      type: 'receive',
      detail: id,
    });

    return securityHeaders(Response.json({ ok: true }));
  } catch (error) {
    return securityHeaders(toApiError(error));
  }
}

export const dynamic = 'force-dynamic';
