import { AsyncLocalStorage } from 'async_hooks';

import type { Role } from '@prisma/client';

export interface RequestContext {
  requestId: string;
  userId?: string;
  organizationId?: string;
  /** Role of the authenticated user within the current organization. */
  role?: Role;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}
