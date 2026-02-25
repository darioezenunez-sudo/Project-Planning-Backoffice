/**
 * Email templates for Resend. Each template returns { subject, html } from structured data.
 */

export type ConsolidationReadyData = {
  echelonName: string;
  productName: string;
  reviewUrl?: string;
};

export type EchelonClosedData = {
  echelonName: string;
  productName: string;
  companyName: string;
  reportAttached?: boolean;
};

export type BudgetAlertData = {
  organizationName?: string;
  percentage: number;
  limitTokens: number;
  currentTokens: number;
  monthYear: string;
};

export type DeviceEnrolledData = {
  userName?: string;
  machineId: string;
  os?: string;
};

export type EmailTemplateData =
  | { template: 'CONSOLIDATION_READY'; data: ConsolidationReadyData }
  | { template: 'ECHELON_CLOSED'; data: EchelonClosedData }
  | { template: 'BUDGET_ALERT'; data: BudgetAlertData }
  | { template: 'DEVICE_ENROLLED'; data: DeviceEnrolledData };

function consolidationReady(data: ConsolidationReadyData): { subject: string; html: string } {
  const subject = `Consolidation ready: ${data.echelonName}`;
  const reviewLink = data.reviewUrl
    ? `<p><a href="${escapeHtml(data.reviewUrl)}">Review consolidation</a></p>`
    : '';
  const html = `
    <h2>Echelon ready for review</h2>
    <p><strong>${escapeHtml(data.echelonName)}</strong> (${escapeHtml(data.productName)}) is ready for closure review.</p>
    ${reviewLink}
  `.trim();
  return { subject, html };
}

function echelonClosed(data: EchelonClosedData): { subject: string; html: string } {
  const subject = `Echelon closed: ${data.echelonName}`;
  const reportNote = data.reportAttached ? '<p>The consolidation report is attached.</p>' : '';
  const html = `
    <h2>Echelon closed</h2>
    <p><strong>${escapeHtml(data.echelonName)}</strong> for ${escapeHtml(data.productName)} (${escapeHtml(data.companyName)}) has been closed.</p>
    ${reportNote}
  `.trim();
  return { subject, html };
}

function budgetAlert(data: BudgetAlertData): { subject: string; html: string } {
  const subject = `Budget alert: ${String(data.percentage)}% of token limit used`;
  const org = data.organizationName
    ? `<p>Organization: ${escapeHtml(data.organizationName)}</p>`
    : '';
  const html = `
    <h2>Budget threshold reached</h2>
    ${org}
    <p>Token usage for ${escapeHtml(data.monthYear)}: <strong>${data.currentTokens.toLocaleString()}</strong> / ${data.limitTokens.toLocaleString()} (${String(data.percentage)}%).</p>
  `.trim();
  return { subject, html };
}

function deviceEnrolled(data: DeviceEnrolledData): { subject: string; html: string } {
  const subject = 'New device enrolled';
  const user = data.userName ? `<p>User: ${escapeHtml(data.userName)}</p>` : '';
  const html = `
    <h2>Device enrolled</h2>
    ${user}
    <p>Machine ID: <code>${escapeHtml(data.machineId)}</code></p>
    ${data.os ? `<p>OS: ${escapeHtml(data.os)}</p>` : ''}
  `.trim();
  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderEmailTemplate(input: EmailTemplateData): { subject: string; html: string } {
  switch (input.template) {
    case 'CONSOLIDATION_READY':
      return consolidationReady(input.data);
    case 'ECHELON_CLOSED':
      return echelonClosed(input.data);
    case 'BUDGET_ALERT':
      return budgetAlert(input.data);
    case 'DEVICE_ENROLLED':
      return deviceEnrolled(input.data);
    default: {
      const _: never = input;
      return { subject: '', html: '' };
    }
  }
}
