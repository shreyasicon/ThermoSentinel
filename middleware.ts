import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_API_ORIGINS;
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [
    'https://main.dx55a7yx23a8.amplifyapp.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
}

function isDevTunnelOrigin(origin: string): boolean {
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const { hostname } = new URL(origin);
    const h = hostname.toLowerCase();
    return (
      h.endsWith('.ngrok-free.dev') ||
      h.endsWith('.ngrok.io') ||
      h.endsWith('.ngrok.app') ||
      h.endsWith('.localtunnel.me') ||
      h.endsWith('.loca.lt')
    );
  } catch {
    return false;
  }
}

function applyCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');
  const allowed = getAllowedOrigins();
  const ok =
    origin &&
    (allowed.includes(origin) || isDevTunnelOrigin(origin));
  if (ok && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Cache-Control',
  );
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

export function middleware(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    return applyCors(request, res);
  }

  const res = NextResponse.next();
  return applyCors(request, res);
}

export const config = {
  matcher: '/api/:path*',
};
