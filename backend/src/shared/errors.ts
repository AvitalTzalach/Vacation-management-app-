/**
 * Application errors.
 *
 * Business code throws these classes to say *what* went wrong, without knowing anything about
 * HTTP. The HTTP layer (handlers/http/error-response.ts) is the only place that turns them into
 * status codes, so the mapping lives in one spot.
 */

// Base class: a stable machine-readable `code`, a human-readable message, optional details.
export abstract class AppError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }
}

// One invalid field, used in `details` of validation errors.
export interface FieldError {
  field: string;
  message: string;
}

// Invalid input or broken business rule (rules 1, 4, 5).
export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";

  constructor(message: string, details?: FieldError[]) {
    super(message, details);
  }
}

// Missing, invalid or expired credentials / token.
export class UnauthorizedError extends AppError {
  readonly code = "UNAUTHORIZED";
}

// Authenticated, but not allowed to do this (wrong role, rule 6).
export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
}

// The requested resource does not exist.
export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
}

// The action conflicts with the current state (overlap, request no longer Pending).
export class ConflictError extends AppError {
  readonly code = "CONFLICT";
}
