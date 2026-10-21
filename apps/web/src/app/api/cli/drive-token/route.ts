import { getDb } from '#/db/client';
import { users } from '#/db/schema';
import { eq } from 'drizzle-orm';
import { requireDevice, toApiError } from '#/lib/api-guard';
import { getAccessTokenWithExpiry, GoogleError, ensureRootFolder } from '#/lib/google';
import { rateLimit } from '#/lib/rate-limit';
import { recordServerEvent } from '#/lib/record-event';
import { securityHeaders } from '#/lib/request-security';
import { jsonError } from '#/lib/api-guard';

export async function POST(request: Request) {
  const db = getDb();

  try {
    const device = await requireDevice(request, db);

    const limit = rateLimit(`drive-token:${device.deviceId}`, 120);
    if (!limit.allowed) {
      return securityHeaders(
        jsonError('Slow down', 429, { retry_after: limit.retryAfterSeconds }),
      );
    }

    const { accessToken, expiresAt } = await getAccessTokenWithExpiry(db, device.userId);
    const user = await db.query.users.findFirst({ where: eq(users.id, device.userId) });
    if (!user) return securityHeaders(jsonError('Account not found', 404));

    const rootFolderId = await ensureRootFolder(db, accessToken, device.userId);
    await recordServerEvent(db, {
      userId: device.userId,
      deviceId: device.deviceId,
      type: 'drive_token_issued',
    });

    return securityHeaders(
      Response.json({
        access_token: accessToken,
        // The real remaining life, not Google's nominal hour: a cached token
        // can be handed over with seconds left.
        expires_at: expiresAt.getTime(),
        expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
        root_folder_id: rootFolderId,
        email: user.email,
      }),
    );
  } catch (error) {
    if (error instanceof GoogleError) {
      return securityHeaders(jsonError(error.message, error.status));
    }
    return securityHeaders(toApiError(error));
  }
}

export const dynamic = 'force-dynamic';
