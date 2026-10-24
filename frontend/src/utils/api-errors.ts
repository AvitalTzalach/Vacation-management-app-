/**
 * Turns API / network errors into messages that can be shown to the user.
 */
import { isAxiosError } from "axios";
import type { ApiErrorBody } from "@/types";

// Reads the uniform API error body, if the response has one.
function getApiError(error: unknown): ApiErrorBody["error"] | null {
  if (!isAxiosError<ApiErrorBody>(error)) return null;
  return error.response?.data?.error ?? null;
}

// HTTP status of a failed request (undefined for network errors).
export function getErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * The message to display for an error:
 * - the API's own message when there is one (e.g. "Invalid email or password.");
 * - a clear message when the server cannot be reached;
 * - otherwise the given fallback.
 */
export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const apiError = getApiError(error);
  if (apiError?.message) return apiError.message;
  if (isAxiosError(error) && !error.response) {
    return "Cannot reach the server. Check that the API is running and try again.";
  }
  return fallback;
}

// The request that blocks a new one (409 overlap), as sent in `details.conflictingRequest`.
export interface ConflictingRequest {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
}

// Returns the conflicting request of an overlap error, or null for any other error.
export function getConflictingRequest(error: unknown): ConflictingRequest | null {
  const details = getApiError(error)?.details as { conflictingRequest?: ConflictingRequest } | undefined;
  return details?.conflictingRequest ?? null;
}

/**
 * Field-level validation errors returned by the API (400), as { field: message },
 * so forms can show each message next to its input.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  const details = getApiError(error)?.details;
  if (!Array.isArray(details)) return {};

  const fields: Record<string, string> = {};
  for (const item of details) {
    if (item && typeof item.field === "string" && typeof item.message === "string" && !fields[item.field]) {
      fields[item.field] = item.message;
    }
  }
  return fields;
}
