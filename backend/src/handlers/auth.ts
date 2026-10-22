/**
 * HTTP handlers for authentication (routes declared in root.yaml).
 *
 *   POST /auth/login → { token, user }
 */
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { Response } from "commoneventframework";
import { getCommandBus } from "../bootstrap";
import { LoginInput, loginSchema } from "../modules/auth/auth.schemas";
import { LoginCommand } from "../modules/auth/login.command";
import { withErrorHandling } from "./http/error-response";
import { parseJsonBody, validate } from "./http/parse-input";
import { InputParserFn } from "./types";

// --- POST /auth/login (public) ---

export const parseLoginInput: InputParserFn = (event: CommonEvent) => {
  const body = parseJsonBody(event);
  if (body instanceof Response) return body;
  return validate(loginSchema, body);
};

export const login = withErrorHandling(async (input: LoginInput) =>
  getCommandBus().execute(new LoginCommand(input.email, input.password))
);
