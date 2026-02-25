/**
 * PDF adapter — @react-pdf/renderer. Factory returns { generateConsolidationReport(data) }.
 */
import ReactPDF from '@react-pdf/renderer';
import React from 'react';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';

import { ConsolidationReportDocument } from './pdf.templates/consolidation-report';
import type { ConsolidationReportPdfData } from './pdf.templates/consolidation-report';

export type PdfAdapter = {
  generateConsolidationReport(data: ConsolidationReportPdfData): Promise<Result<Buffer, AppError>>;
};

export function createPdfAdapter(): PdfAdapter {
  async function generateConsolidationReport(
    data: ConsolidationReportPdfData,
  ): Promise<Result<Buffer, AppError>> {
    try {
      const element = React.createElement(ConsolidationReportDocument, {
        data,
      });
      const buffer = await ReactPDF.renderToBuffer(
        element as Parameters<typeof ReactPDF.renderToBuffer>[0],
      );
      const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      if (nodeBuffer.length === 0) {
        return err(
          new AppError(
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            500,
            'PDF generation produced empty buffer',
            { provider: 'react-pdf' },
          ),
        );
      }
      return ok(nodeBuffer);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(
        new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 500, message, {
          provider: 'react-pdf',
        }),
      );
    }
  }

  return { generateConsolidationReport };
}
