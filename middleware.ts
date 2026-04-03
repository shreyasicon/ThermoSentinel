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

function applyCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');
  const allowed = getAllowedOrigins();
  if (origin && allowed.includes(origin)) {
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
