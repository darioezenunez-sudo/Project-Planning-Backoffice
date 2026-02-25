import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Lower in production; 1.0 captures every transaction (fine for low-traffic backoffice)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  enableLogs: true,

  // Captures PII such as user IDs and IP — acceptable for an internal backoffice
  sendDefaultPii: true,
});
