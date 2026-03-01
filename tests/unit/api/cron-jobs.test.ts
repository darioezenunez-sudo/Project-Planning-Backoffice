import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Prisma mock (prevents real DB calls) ─────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('GET /api/cron/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  async function callRoute(req: NextRequest): Promise<Response> {
    // Dynamic import so CRON_SECRET is re-read from process.env at call time.
    const mod = await import('@/app/api/cron/jobs/route');
    return mod.GET(req);
  }

  it('returns 200 with an empty summary when no jobs are ready', async () => {
    const req = new NextRequest('http://localhost/api/cron/jobs');
    const res = await callRoute(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, number> };
    expect(body.data).toMatchObject({ processed: 0, failed: 0, skipped: 0, total: 0 });
  });

  it('returns 401 when CRON_SECRET is set but the auth header is absent', async () => {
    process.env.CRON_SECRET = 'super-secret';

    const req = new NextRequest('http://localhost/api/cron/jobs');
    const res = await callRoute(req);

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when CRON_SECRET is set but the bearer value is wrong', async () => {
    process.env.CRON_SECRET = 'super-secret';

    const req = new NextRequest('http://localhost/api/cron/jobs', {
      headers: { authorization: 'Bearer wrong-value' },
    });
    const res = await callRoute(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 when CRON_SECRET is set and the correct bearer is provided', async () => {
    process.env.CRON_SECRET = 'super-secret';

    const req = new NextRequest('http://localhost/api/cron/jobs', {
      headers: { authorization: 'Bearer super-secret' },
    });
    const res = await callRoute(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, number> };
    expect(body.data).toMatchObject({ processed: 0, total: 0 });
  });

  it('does not require auth when CRON_SECRET env var is not set', async () => {
    // No CRON_SECRET set → any request passes auth check
    const req = new NextRequest('http://localhost/api/cron/jobs');
    const res = await callRoute(req);
    expect(res.status).toBe(200);
  });
});
