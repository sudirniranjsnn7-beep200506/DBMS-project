// ==============================================================================
// AssetVault: Typed Application Error Hierarchy
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

export interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ErrorDetails;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: ErrorDetails) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: ErrorDetails) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Error', details?: ErrorDetails) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: ErrorDetails) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: ErrorDetails) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found', details?: ErrorDetails) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: ErrorDetails) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable Entity', details?: ErrorDetails) {
    super(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too Many Requests', details?: ErrorDetails) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

export const TooManyRequestsError = RateLimitError;
