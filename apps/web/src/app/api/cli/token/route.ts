import { getDb } from '#/db/client';
import { DeviceTokenError, issueTokenPair, rotateRefreshToken } from '#/lib/device-tokens';
import { pollDeviceAuthRequest } from '#/lib/device-auth';
import { recordServerEvent } from '#/lib/record-event';
import { securityHeaders } from '#/lib/request-security';
import { tokenRequestSchema } from '#/lib/schemas';
import { DEVICE_ACCESS_TOKEN_TTL_SECONDS } from '#/lib/constants';

function oauthError(error: string, extra: Record<string, unknown> = {}): Response {
  return securityHeaders(Response.json({ error, ...extra }, { status: 400 }));
}

export async function POST(request: Request) {
  const parsed = tokenRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return oauthError('invalid_request');

  const db = getDb();

  try {
    if (parsed.data.grant_type === 'refresh_token') {
      const rotated = await rotateRefreshToken(db, parsed.data.refresh_token);
      return securityHeaders(
        Response.json(tokenResponse(rotated.tokens, rotated.device)),
      );
    }

    const outcome = await pollDeviceAuthRequest(db, parsed.data.device_code);

    if (outcome.status === 'slow_down') {
      return oauthError('slow_down', { interval: outcome.interval });
    }
    if (outcome.status === 'authorization_pending') return oauthError('authorization_pending');
    if (outcome.status === 'expired_token') return oauthError('expired_token');
    if (outcome.status === 'access_denied') return oauthError('access_denied');

    const tokens = await issueTokenPair(db, outcome.deviceId);
    await recordServerEvent(db, {
      userId: outcome.userId,
      deviceId: outcome.deviceId,
      type: 'login',
      detail: outcome.deviceName,
    });
    return securityHeaders(Response.json(tokenResponse(tokens, outcome)));
  } catch (error) {
    if (error instanceof DeviceTokenError) {
      const status = error.code === 'reuse' || error.code === 'revoked' ? 401 : 400;
      return securityHeaders(
        Response.json({ error: error.message, error_code: error.code }, { status }),
      );
    }
    return oauthError('server_error');
  }
}

function tokenResponse(
  tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date },
  device: { deviceId: string; deviceName: string },
) {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: 'Bearer',
    expires_in: DEVICE_ACCESS_TOKEN_TTL_SECONDS,
    refresh_expires_at: tokens.refreshExpiresAt.toISOString(),
    device: { id: device.deviceId, name: device.deviceName },
  };
}

export const dynamic = 'force-dynamic';
