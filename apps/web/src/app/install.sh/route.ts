import { baseUrl } from '#/lib/env';
import { renderInstallScript } from '#/lib/install-script';
import { securityHeaders } from '#/lib/request-security';

export async function GET() {
  const script = renderInstallScript(baseUrl());
  return securityHeaders(
    new Response(script, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }),
  );
}

export const dynamic = 'force-dynamic';
