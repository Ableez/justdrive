import { NextResponse, type NextRequest } from 'next/server';
import { isSameOrigin, securityHeaders } from '#/lib/request-security';

export function proxy(request: NextRequest) {
  // /api/cli authenticates with a bearer token rather than a cookie, so a
  // cross-site page cannot ride the user's session there; the check below would
  // only break the CLI, which sends no Origin header.
  if (request.nextUrl.pathname.startsWith('/api/cli')) {
    return securityHeaders(NextResponse.next());
  }

  if (!isSameOrigin(request)) {
    return securityHeaders(
      NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 }),
    );
  }
  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
