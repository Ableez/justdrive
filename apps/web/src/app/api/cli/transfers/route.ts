import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { getDb } from '#/db/client';
import { devices, transfers } from '#/db/schema';
import { ApiError, requireDevice, toApiError } from '#/lib/api-guard';
import { securityHeaders } from '#/lib/request-security';
import { createTransferSchema } from '#/lib/schemas';
import { TRANSFER_TTL_HOURS } from '#/lib/constants';

export async function GET(request: Request) {
  const db = getDb();
  try {
    const device = await requireDevice(request, db);
    const inbox = new URL(request.url).searchParams.get('inbox') === '1';

    await expireStaleTransfers(db, device.userId);

    const rows = await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.userId, device.userId),
          inbox
            ? and(eq(transfers.toDeviceId, device.deviceId), eq(transfers.status, 'pending'))
            : or(
                eq(transfers.fromDeviceId, device.deviceId),
                eq(transfers.toDeviceId, device.deviceId),
              ),
        ),
      )
      .orderBy(desc(transfers.createdAt))
      .limit(100);

    return securityHeaders(
      Response.json({
        transfers: rows.map((row) => ({
          id: row.id,
          drive_file_id: row.driveFileId,
          name: row.name,
          bytes: row.bytes,
          status: row.status,
          direction: row.toDeviceId === device.deviceId ? 'in' : 'out',
          created_at: row.createdAt.toISOString(),
        })),
      }),
    );
  } catch (error) {
    return securityHeaders(toApiError(error));
  }
}

export async function POST(request: Request) {
  const db = getDb();
  try {
    const device = await requireDevice(request, db);
    const parsed = createTransferSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError('Invalid request', 400);

    const target = await db.query.devices.findFirst({
      where: and(
        eq(devices.userId, device.userId),
        eq(devices.name, parsed.data.to),
        isNull(devices.revokedAt),
      ),
    });
    if (!target) {
      throw new ApiError(`No active device named "${parsed.data.to}". Run: justdrive devices`, 404);
    }
    if (target.id === device.deviceId) throw new ApiError('That is this device', 400);

    const id = randomUUID();
    await db.insert(transfers).values({
      id,
      userId: device.userId,
      fromDeviceId: device.deviceId,
      toDeviceId: target.id,
      driveFileId: parsed.data.drive_file_id,
      name: parsed.data.name,
      bytes: parsed.data.bytes,
    });

    return securityHeaders(Response.json({ id, status: 'pending' }, { status: 201 }));
  } catch (error) {
    return securityHeaders(toApiError(error));
  }
}

async function expireStaleTransfers(db: ReturnType<typeof getDb>, userId: string): Promise<void> {
  await db
    .update(transfers)
    .set({ status: 'expired' })
    .where(
      and(
        eq(transfers.userId, userId),
        eq(transfers.status, 'pending'),
        lt(transfers.createdAt, new Date(Date.now() - TRANSFER_TTL_HOURS * 3600_000)),
      ),
    );
}

export const dynamic = 'force-dynamic';
