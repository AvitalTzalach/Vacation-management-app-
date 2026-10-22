/**
 * HTTP handlers for vacation requests (routes declared in root.yaml).
 *
 *   POST /vacation-requests       → 201 + the created request    (Requester)
 *   GET  /vacation-requests/mine  → paginated list of own requests (Requester)
 *
 * Handlers stay thin: input parsers authenticate and validate, handlers dispatch a command
 * (writes) or call a query (reads). The user id always comes from `input.auth` (the JWT).
 */
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { Response } from "commoneventframework";
import { getCommandBus } from "../bootstrap";
import { getDataSource } from "../database/data-source";
import { UserRole } from "../modules/users/user.entity";
import { CreateVacationRequestCommand } from "../modules/vacation-requests/commands/create-vacation-request.command";
import { listMyVacationRequests } from "../modules/vacation-requests/vacation-request.queries";
import {
  CreateVacationRequestInput,
  createVacationRequestSchema,
} from "../modules/vacation-requests/vacation-request.schemas";
import { PaginationQuery, paginationQuerySchema } from "../shared/pagination";
import { AuthenticatedInput, protectedInputParser } from "./http/auth-guard";
import { withErrorHandling } from "./http/error-response";
import { getQueryParams, parseJsonBody, validate } from "./http/parse-input";

// --- POST /vacation-requests (Requester) ---

export const parseCreateVacationRequestInput = protectedInputParser(
  [UserRole.Requester],
  (event: CommonEvent) => {
    const body = parseJsonBody(event);
    if (body instanceof Response) return body;
    return validate(createVacationRequestSchema, body);
  }
);

export const createVacationRequest = withErrorHandling(
  async (input: AuthenticatedInput<CreateVacationRequestInput>) => {
    const created = await getCommandBus().execute(
      new CreateVacationRequestCommand(input.auth.userId, input.startDate, input.endDate, input.reason)
    );
    return new Response(201, created);
  }
);

// --- GET /vacation-requests/mine?page&limit (Requester) ---

export const parseListMyVacationRequestsInput = protectedInputParser(
  [UserRole.Requester],
  (event: CommonEvent) => validate(paginationQuerySchema, getQueryParams(event))
);

export const listMyRequests = withErrorHandling(
  async (input: AuthenticatedInput<PaginationQuery>) => {
    const { auth, ...pagination } = input;
    return listMyVacationRequests(await getDataSource(), auth.userId, pagination);
  }
);
