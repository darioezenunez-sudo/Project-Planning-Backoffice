import { describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { createPdfAdapter } from '@/modules/integration/pdf.adapter';

vi.mock('@react-pdf/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-pdf/renderer')>();
  const mod = actual as unknown as Record<string, unknown>;
  return {
    ...mod,
    default: {
      ...(mod.default as Record<string, unknown>),
      renderToBuffer: vi.fn(),
    },
  };
});

describe('createPdfAdapter', () => {
  const validData = {
    echelonName: 'E1',
    productName: 'P1',
    companyName: 'C1',
    date: '2026-02-24',
    executiveSummary: 'Summary text.',
    decisions: [{ title: 'D1', description: 'Desc' }],
    checklist: [{ label: 'L1', met: true }],
  };

  it('returns non-empty buffer for valid input', async () => {
    const ReactPDF = (await import('@react-pdf/renderer')).default;
    const mockBuffer = Buffer.from('mock-pdf-content');
    vi.mocked(ReactPDF.renderToBuffer).mockResolvedValue(mockBuffer);

    const adapter = createPdfAdapter();
    const result = await adapter.generateConsolidationReport(validData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Buffer.isBuffer(result.value)).toBe(true);
      expect(result.value.length).toBeGreaterThan(0);
      expect(result.value.toString()).toBe('mock-pdf-content');
    }
  });

  it('returns AppError when renderToBuffer throws', async () => {
    const ReactPDF = (await import('@react-pdf/renderer')).default;
    vi.mocked(ReactPDF.renderToBuffer).mockRejectedValue(new Error('Render failed'));

    const adapter = createPdfAdapter();
    const result = await adapter.generateConsolidationReport(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
      expect(result.error.message).toBe('Render failed');
    }
  });

  it('returns AppError when buffer is empty', async () => {
    const ReactPDF = (await import('@react-pdf/renderer')).default;
    vi.mocked(ReactPDF.renderToBuffer).mockResolvedValue(Buffer.alloc(0));

    const adapter = createPdfAdapter();
    const result = await adapter.generateConsolidationReport(validData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error.code).toBe(ErrorCode.EXTERNAL_SERVICE_ERROR);
    }
  });
});
