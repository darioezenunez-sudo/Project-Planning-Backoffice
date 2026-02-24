import { NextRequest, NextResponse } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the audit module so we don't hit the DB
vi.mock('@/modules/audit/audit.repository', () => ({
  createAuditRepository: vi.fn(() => ({ create: vi.fn(), findMany: vi.fn() })),
}));

vi.mock('@/modules/audit/audit.service', () => ({
  createAuditService: vi.fn(() => ({
    log: vi.fn(),
    logFromContext: vi.fn().mockResolvedValue(undefined),
    getByEntity: vi.fn(),
  })),
}));

// Import AFTER mocks are registered
const { withAudit } = await import('@/lib/middleware/with-audit');
const { createAuditService } = await import('@/modules/audit/audit.service');

const mockLogFromContext = vi.mocked(createAuditService).mock.results[0]?.value
  .logFromContext as ReturnType<typeof vi.fn>;

function makeRequest(method: string, url = 'http://localhost/api/v1/companies'): NextRequest {
  return new NextRequest(url, { method });
}

function makeResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(
    { data: body, meta: { timestamp: '2026-01-01T00:00:00.000Z' } },
    { status },
  );
}

describe('withAudit middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through GET requests without logging', async () => {
    const handler = vi.fn().mockResolvedValue(makeResponse({ id: 'abc' }));
    const wrapped = withAudit('Company')(handler);

    await wrapped(makeRequest('GET'), { params: Promise.resolve({}) });

    expect(handler).toHaveBeenCalledOnce();
    expect(mockLogFromContext).not.toHaveBeenCalled();
  });

  it('does not log when handler returns an error response (4xx)', async () => {
    const errorRes = NextResponse.json({ error: 'bad' }, { status: 400 });
    const handler = vi.fn().mockResolvedValue(errorRes);
    const wrapped = withAudit('Company')(handler);

    await wrapped(makeRequest('POST'), { params: Promise.resolve({}) });

    expect(mockLogFromContext).not.toHaveBeenCalled();
  });

  it('logs CREATE for a successful POST with entity id in response body', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(
        makeResponse({ id: '11111111-1111-1111-1111-111111111111', name: 'Test' }, 201),
      );
    const wrapped = withAudit('Company')(handler);

    await wrapped(makeRequest('POST'), { params: Promise.resolve({}) });

    // Give the fire-and-forget promise a tick to settle
    await Promise.resolve();

    expect(mockLogFromContext).toHaveBeenCalledWith(
      'Company',
      '11111111-1111-1111-1111-111111111111',
      'CREATE',
      expect.objectContaining({}),
    );
  });

  it('logs UPDATE for a successful PATCH using the UUID from the URL', async () => {
    const id = '22222222-2222-2222-2222-222222222222';
    const handler = vi.fn().mockResolvedValue(makeResponse({ id, name: 'Updated' }));
    const wrapped = withAudit('Company')(handler);

    await wrapped(makeRequest('PATCH', `http://localhost/api/v1/companies/${id}`), {
      params: Promise.resolve({ id }),
    });

    await Promise.resolve();

    expect(mockLogFromContext).toHaveBeenCalledWith('Company', id, 'UPDATE', expect.any(Object));
  });

  it('logs DELETE for a successful DELETE using the UUID from the URL', async () => {
    const id = '33333333-3333-3333-3333-333333333333';
    // Use 200 in tests — jsdom doesn't accept 204 in NextResponse constructor
    const handler = vi.fn().mockResolvedValue(NextResponse.json(null, { status: 200 }));
    const wrapped = withAudit('Company')(handler);

    await wrapped(makeRequest('DELETE', `http://localhost/api/v1/companies/${id}`), {
      params: Promise.resolve({ id }),
    });

    await Promise.resolve();

    expect(mockLogFromContext).toHaveBeenCalledWith('Company', id, 'DELETE', expect.any(Object));
  });
});
