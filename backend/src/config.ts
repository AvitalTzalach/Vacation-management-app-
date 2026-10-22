/**
 * Application configuration.
 *
 * This is the ONLY file that reads environment variables. It uses CEF's `getEnvValue`,
 * which throws when a mandatory variable is missing, so a misconfigured server fails fast
 * with a clear message instead of running with a silent default.
 *
 * Values are read through functions (not module-level constants) on purpose:
 * `.env` is loaded asynchronously by `loadEnv()` in the entry point, so reading
 * `process.env` at import time could happen before the file is loaded.
 */
import { getEnvValue } from "commoneventframework/dist/utils/getEnvValue";

// Connection settings for PostgreSQL. All values are mandatory (no fallback).
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

// Settings used to sign and verify JSON Web Tokens.
export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

// Tokens are valid for one working day; there is no refresh token (see README limitations).
const JWT_EXPIRES_IN = "8h";

/**
 * Returns a mandatory environment variable.
 * `getEnvValue` is typed as `string | undefined` but throws instead of returning undefined
 * when no fallback is given, so the cast is safe.
 */
function requireEnv(key: string): string {
  return getEnvValue(key) as string;
}

// Reads the database settings from the environment.
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: requireEnv("DB_HOST"),
    port: Number(requireEnv("DB_PORT")),
    username: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
  };
}

// Reads the JWT settings. The secret has no default value in code by design.
export function getJwtConfig(): JwtConfig {
  return {
    secret: requireEnv("JWT_SECRET"),
    expiresIn: JWT_EXPIRES_IN,
  };
}
