import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { createEmailAdapter } from '@/modules/integration/email.adapter';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('createEmailAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends CONSOLIDATION_READY and returns id', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg-123' }, error: null });
    const adapter = createEmailAdapter('re_xxx');
    const result = await adapter.send('CONSOLIDATION_READY', 'a@b.com', {
      echelonName: 'E1',
      productName: 'P1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe('msg-123');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['a@b.com'],
        subject: expect.stringContaining('E1'),
        html: expect.any(String),
      }),
    );
  });

  it('returns AppError on Resend error', async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'Rate limited', name: 'rate_limit' },
    });
    const adapter = createEmailAdapter('re_xxx');
    const result = await adapter.send('BUDGET_ALERT', 'a@b.com', {
      percentage: 80,
      limitTokens: 100000,
      currentTokens: 80000,
      monthYear: '2026-02',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
      expect(result.error.message).toBe('Rate limited');
    }
  });

  it('returns AppError when Resend returns no id', async () => {
    sendMock.mockResolvedValue({ data: {}, error: null });
    const adapter = createEmailAdapter('re_xxx');
    const result = await adapter.send('DEVICE_ENROLLED', 'a@b.com', {
      machineId: 'mid-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
  });

  it('returns AppError on throw', async () => {
    sendMock.mockRejectedValue(new Error('Network error'));
    const adapter = createEmailAdapter('re_xxx');
    const result = await adapter.send('ECHELON_CLOSED', 'a@b.com', {
      echelonName: 'E1',
      productName: 'P1',
      companyName: 'C1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.message).toBe('Network error');
    }
  });
});
