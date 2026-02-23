import type { NextRequest } from 'next/server';

import { compose, withErrorHandling, type RouteContext } from '@/lib/middleware';
import { apiSuccess } from '@/lib/utils/api-response';

const startTime = Date.now();

async function healthHandler(req: NextRequest, _context: RouteContext) {
  const shallow = new URL(req.url).searchParams.get('shallow') === 'true';

  if (shallow) {
    return apiSuccess({ status: 'ok' });
  }

  const checks: Record<string, string> = {};
  if (process.env.DATABASE_URL) {
    try {
      const { prisma } = await import('@/lib/prisma');
      await prisma.healthCheck.findFirst();
      checks.db = 'ok';
    } catch {
      checks.db = 'error';
    }
  } else {
    checks.db = 'skipped';
  }

  return apiSuccess(
    {
      status: checks.db === 'error' ? 'degraded' : 'ok',
      checks,
      version: '1.0.0',
      uptime_ms: Date.now() - startTime,
    },
    {},
    200,
  );
}

export const GET = compose(withErrorHandling)(healthHandler);
