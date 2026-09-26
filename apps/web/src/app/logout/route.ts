import { destroyWebSession } from '#/lib/session';
import { securityHeaders } from '#/lib/request-security';

export async function POST(request: Request) {
  await destroyWebSession();
  return securityHeaders(Response.redirect(new URL('/', new URL(request.url).origin)));
}
