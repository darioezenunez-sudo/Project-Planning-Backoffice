/**
 * Email adapter — Resend SDK integration. Factory returns { send(template, to, data) }.
 */
import { Resend } from 'resend';

import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';

import type {
  BudgetAlertData,
  ConsolidationReadyData,
  DeviceEnrolledData,
  EchelonClosedData,
  EmailTemplateData,
} from './email.templates';
import { renderEmailTemplate } from './email.templates';

export type EmailTemplateDataMap = EmailTemplateData;

export type EmailAdapter = {
  send(
    template: EmailTemplateData['template'],
    to: string,
    data: ConsolidationReadyData | EchelonClosedData | BudgetAlertData | DeviceEnrolledData,
  ): Promise<Result<{ id: string }, AppError>>;
};

export function createEmailAdapter(apiKey: string): EmailAdapter {
  const resend = new Resend(apiKey);

  async function send(
    template: EmailTemplateData['template'],
    to: string,
    data: ConsolidationReadyData | EchelonClosedData | BudgetAlertData | DeviceEnrolledData,
  ): Promise<Result<{ id: string }, AppError>> {
    const payload = renderEmailTemplate({ template, data } as EmailTemplateData);
    try {
      const { data: res, error } = await resend.emails.send({
        from: 'Backoffice <onboarding@resend.dev>',
        to: [to],
        subject: payload.subject,
        html: payload.html,
      });
      if (error) {
        return err(
          new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, error.message, {
            provider: 'resend',
            code: error.name,
          }),
        );
      }
      const id = res.id;
      if (!id) {
        return err(
          new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, 'Resend returned no id', {
            provider: 'resend',
          }),
        );
      }
      return ok({ id });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(
        new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, message, { provider: 'resend' }),
      );
    }
  }

  return { send };
}
