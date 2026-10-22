/**
 * Turns application errors into CEF HTTP responses — the single place where error classes are
 * mapped to status codes.
 *
 * CEF's entry point answers 500 with the raw error for anything a handler throws, so every
 * handler is wrapped with `withErrorHandling` to return a proper status and a uniform body:
 *   { error: { code, message, details? } }
 */
import { Response } from "commoneventframework";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../shared/errors";
import { HandlerFn } from "../types";

// HTTP status for each application error class.
const STATUS_BY_ERROR = new Map<Function, number>([
  [ValidationError, 400],
  [UnauthorizedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
]);

// Builds an error response with the uniform error body.
export function errorBody(status: number, code: string, message: string, details?: unknown): Response {
  return new Response(status, {
    error: details === undefined ? { code, message } : { code, message, details },
  });
}

/**
 * Converts any thrown value into a Response.
 * Known application errors keep their message; unexpected errors are logged on the server and
 * answered with a generic 500, so internal details (SQL, stack traces) never reach the client.
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    const status = STATUS_BY_ERROR.get(error.constructor) ?? 500;
    return errorBody(status, error.code, error.message, error.details);
  }
  console.error("[http] Unexpected error:", error);
  return errorBody(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again.");
}

// Wraps a handler so that any thrown error becomes the right HTTP response.
export function withErrorHandling<TInput>(
  handler: (input: TInput) => Promise<Response | object>
): HandlerFn {
  return async (input: TInput) => {
    try {
      return await handler(input);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
