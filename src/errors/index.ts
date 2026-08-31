/**
 * Standard Application Error Classes
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string | number) {
    super(`${resource} with identifier '${identifier}' was not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class PlatformError extends AppError {
  public readonly platform: string;

  constructor(platform: string, message: string, statusCode = 502, details?: unknown) {
    super(`[${platform.toUpperCase()}] ${message}`, statusCode, 'PLATFORM_ERROR', details);
    this.platform = platform;
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = 'Concurrent request with the same idempotency key is in progress') {
    super(message, 409, 'IDEMPOTENCY_CONFLICT');
  }
}
