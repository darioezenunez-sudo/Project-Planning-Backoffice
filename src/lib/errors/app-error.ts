import type { ErrorCode } from './error-codes';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: number,
    message: string,
    readonly context?: Record<string, unknown>,
    readonly cause?: Error,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
