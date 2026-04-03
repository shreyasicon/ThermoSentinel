/**
 * Health check for load balancers and autoscaling.
 * GET /api/health returns 200 when the app is ready to accept traffic.
 */
export const dynamic = 'auto';

export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      queue: process.env.REDIS_URL ? 'redis' : 'memory',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
