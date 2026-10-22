/**
 * JSON Web Token helpers: sign a token at login, verify it on every protected request.
 *
 * Verification is synchronous on purpose: CEF calls input parsers without `await`,
 * and authentication runs inside the input parser (so 401 comes before 400).
 */
import jwt from "jsonwebtoken";
import { getJwtConfig } from "../../config";
import { UnauthorizedError } from "../../shared/errors";
import { UserRole } from "../users/user.entity";

// The identity carried by a valid token.
export interface AuthContext {
  userId: number;
  role: UserRole;
}

// Only this algorithm is accepted when verifying (prevents algorithm-confusion attacks).
const ALGORITHM = "HS256";

// Creates a signed token. The user id goes in the standard `sub` claim, the role in a custom claim.
export function signToken(auth: AuthContext): string {
  const { secret, expiresIn } = getJwtConfig();
  return jwt.sign({ role: auth.role }, secret, {
    subject: String(auth.userId),
    expiresIn,
    algorithm: ALGORITHM,
  } as jwt.SignOptions);
}

/**
 * Verifies the signature and expiry of a token and returns its identity.
 * Throws UnauthorizedError for any invalid, expired or malformed token.
 */
export function verifyToken(token: string): AuthContext {
  const { secret } = getJwtConfig();

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  } catch (error) {
    const message =
      error instanceof jwt.TokenExpiredError ? "Session expired, please sign in again." : "Invalid token.";
    throw new UnauthorizedError(message);
  }

  // A correctly signed token must still have the expected shape.
  const userId = typeof payload === "object" ? Number(payload.sub) : NaN;
  const role = typeof payload === "object" ? payload.role : undefined;
  if (!Number.isInteger(userId) || userId <= 0 || !Object.values(UserRole).includes(role)) {
    throw new UnauthorizedError("Invalid token.");
  }

  return { userId, role };
}
