import { createDeviceAuthRequest } from '#/lib/device-auth';
import { getDb } from '#/db/client';
import { baseUrl } from '#/lib/env';
import { rateLimit } from '#/lib/rate-limit';
import { jsonError } from '#/lib/api-guard';
import { securityHeaders } from '#/lib/request-security';
import { deviceCodeRequestSchema } from '#/lib/schemas';
import { clientIp } from '#/lib/session';

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = rateLimit(`device-code:${ip ?? 'unknown'}`, 10);
  if (!limit.allowed) {
    return securityHeaders(
      jsonError('Too many sign-in requests. Try again in a minute.', 429, {
        retry_after: limit.retryAfterSeconds,
      }),
    );
  }

  const parsed = deviceCodeRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return securityHeaders(jsonError('Invalid request', 400));

  const meta = await createDeviceAuthRequest(getDb(), baseUrl(), {
    hostname: parsed.data.hostname,
    os: parsed.data.os,
    cliVersion: parsed.data.cli_version,
    requestIp: ip ?? undefined,
  });

  return securityHeaders(Response.json(meta));
}
