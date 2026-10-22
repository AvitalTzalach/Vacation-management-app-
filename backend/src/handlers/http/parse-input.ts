/**
 * Input parsing helpers for CEF input parsers (`x-inputParser`).
 *
 * Each helper returns either the parsed value or a CEF `Response` (400) describing the problem.
 * CEF sends a returned Response directly to the client and skips the handler.
 * Everything here is synchronous, because CEF calls input parsers without `await`.
 */
import { Response } from "commoneventframework";
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { ZodType, ZodTypeDef } from "zod";
import { FieldError } from "../../shared/errors";
import { errorBody } from "./error-response";

// Reads the request body as JSON. An empty body is treated as `{}`.
export function parseJsonBody(event: CommonEvent): unknown | Response {
  if (!event.body) return {};

  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return errorBody(400, "VALIDATION_ERROR", "The request body must be valid JSON.");
  }
}

/**
 * Returns the query string parameters, URL-decoded.
 * CEF's dev server passes them through raw (e.g. "%32" instead of "2", "+" instead of a space),
 * so they are decoded here. A malformed escape sequence is kept as-is (validation will reject it).
 */
export function getQueryParams(event: CommonEvent): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(event.queryStringParameters ?? {})) {
    if (value === undefined) continue;
    try {
      params[key] = decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Validates data with a zod schema.
 * On failure, returns a 400 listing every invalid field, e.g.
 *   details: [{ field: "startDate", message: "Start date is required" }]
 */
export function validate<TOutput>(
  schema: ZodType<TOutput, ZodTypeDef, unknown>,
  data: unknown
): TOutput | Response {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const details: FieldError[] = result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
  return errorBody(400, "VALIDATION_ERROR", "Some fields are invalid.", details);
}
