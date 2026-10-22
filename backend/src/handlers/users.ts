/**
 * HTTP handlers for users (routes declared in root.yaml).
 *
 *   GET /users → { data: [{ id, name }] } — requesters only, for the dashboard's user filter (Validator)
 */
import { getDataSource } from "../database/data-source";
import { UserRole } from "../modules/users/user.entity";
import { listRequesters } from "../modules/users/user.queries";
import { protectedInputParser } from "./http/auth-guard";
import { withErrorHandling } from "./http/error-response";

// --- GET /users (Validator) — no input besides the token ---

export const parseListUsersInput = protectedInputParser([UserRole.Validator], () => ({}));

export const listUsers = withErrorHandling(async () => ({
  data: await listRequesters(await getDataSource()),
}));
