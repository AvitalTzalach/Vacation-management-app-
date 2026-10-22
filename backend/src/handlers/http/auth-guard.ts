/**
 * Authentication and role-based access control for the CEF HTTP layer.
 *
 * Runs inside input parsers, in this order:
 *   1. verify the JWT            → 401 if missing / invalid / expired
 *   2. check the user's role     → 403 if not allowed
 *   3. parse and validate input  → 400 if invalid
 * So a request without a valid token never learns whether its body was valid.
 */
import { Response } from "commoneventframework";
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { AuthContext, verifyToken } from "../../modules/auth/jwt";
import { UserRole } from "../../modules/users/user.entity";
import { AppError } from "../../shared/errors";
import { InputParserFn } from "../types";
import { errorBody, toErrorResponse } from "./error-response";

// Every protected handler receives the caller's identity in `input.auth`.
export type AuthenticatedInput<T> = T & { auth: AuthContext };

// Reads a header case-insensitively (the dev server lower-cases names, API Gateway may not).
function getHeader(event: CommonEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  const key = Object.keys(headers).find((header) => header.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

// Extracts and verifies the "Authorization: Bearer <token>" header.
export function authenticate(event: CommonEvent): AuthContext | Response {
  const header = getHeader(event, "authorization");
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return errorBody(401, "UNAUTHORIZED", "Authentication required.");
  }
  try {
    return verifyToken(match[1]);
  } catch (error) {
    if (error instanceof AppError) return toErrorResponse(error);
    throw error;
  }
}

/**
 * Builds an input parser for a protected route.
 *
 * @param allowedRoles roles allowed to call the route (rule 6: only validators approve/reject)
 * @param parse        route-specific parsing, run only after authentication and authorization
 * @returns            `{ auth, ...parsedInput }` — handlers take the user id only from `auth`
 */
export function protectedInputParser<T extends object>(
  allowedRoles: UserRole[],
  parse: (event: CommonEvent) => T | Response
): InputParserFn {
  return (event: CommonEvent) => {
    const auth = authenticate(event);
    if (auth instanceof Response) return auth;

    if (!allowedRoles.includes(auth.role)) {
      return errorBody(403, "FORBIDDEN", "You do not have permission to perform this action.");
    }

    const parsed = parse(event);
    if (parsed instanceof Response) return parsed;

    return { ...parsed, auth } as AuthenticatedInput<T>;
  };
}
