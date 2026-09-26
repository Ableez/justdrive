import { and, eq } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { devices } from '#/db/schema';
import { revokeDeviceTokens } from '#/lib/device-tokens';
import { requireOwnedDevice, requireUserId, toApiError } from '#/lib/api-guard';
import { recordServerEvent } from '#/lib/record-event';
import { securityHeaders } from '#/lib/request-security';
import { renameDeviceSchema } from '#/lib/schemas';
import { ApiError } from '#/lib/api-guard';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const db = getDb();
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = renameDeviceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError('Name must be 1 to 60 characters', 400);

    await requireOwnedDevice(db, userId, id);

    const updated = await db
      .update(devices)
      .set({ name: parsed.data.name })
      .where(and(eq(devices.id, id), eq(devices.userId, userId)))
      .returning({ name: devices.name });

    if (updated.length === 0) throw new ApiError('That name is already taken', 409);
    return securityHeaders(Response.json({ name: updated[0].name }));
  } catch (error) {
    return securityHeaders(toApiError(error));
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const db = getDb();
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const device = await requireOwnedDevice(db, userId, id);

    await db
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(eq(devices.id, device.id));
    await revokeDeviceTokens(db, device.id);
    await recordServerEvent(db, {
      userId,
      deviceId: device.id,
      type: 'device_revoked',
      detail: device.name,
    });

    return securityHeaders(Response.json({ ok: true }));
  } catch (error) {
    return securityHeaders(toApiError(error));
  }
}

export const dynamic = 'force-dynamic';
