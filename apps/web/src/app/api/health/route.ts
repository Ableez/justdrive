import pkg from '../../../../package.json';

export function GET() {
  return Response.json(
    { ok: true, version: pkg.version },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const dynamic = 'force-dynamic';
