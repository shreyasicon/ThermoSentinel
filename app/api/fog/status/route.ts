import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxies fog node GET /status so the browser avoids CORS (dashboard → same origin → fog :4000).
 */
export async function GET() {
  const url =
    process.env.FOG_STATUS_URL ||
    process.env.FOG_INTERNAL_STATUS_URL ||
    'http://127.0.0.1:4000/status';
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });
    const body = await res.json().catch(() => ({ error: 'Invalid JSON from fog' }));
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        error: 'Fog node unreachable',
        hint:
          'With npm run dev the fog process should listen on :4000 (see FOG_PORT). If PORT=3000 is in .env for Next, fog still uses FOG_PORT. Restart after pulling latest. Or set FOG_STATUS_URL.',
        attemptedUrl: url,
      },
      { status: 503 },
    );
  }
}
