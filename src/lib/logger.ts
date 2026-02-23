import pino from 'pino';

import { getRequestContext } from './request-context';

const redactPaths = ['password', 'token', 'apiKey', 'api_key', 'secret', 'authorization', 'cookie'];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  mixin() {
    const ctx = getRequestContext();
    return ctx
      ? { requestId: ctx.requestId, userId: ctx.userId, organizationId: ctx.organizationId }
      : {};
  },
});
