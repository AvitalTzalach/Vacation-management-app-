/**
 * HTTP handlers for vacation requests (routes declared in root.yaml).
 *
 *   POST /vacation-requests                → 201 + the created request          (Requester)
 *   GET  /vacation-requests/mine           → paginated list of own requests      (Requester)
 *   GET  /vacation-requests                → paginated list of all requests,
 *                                            filters status / userId             (Validator)
 *   PUT  /vacation-requests/:id/approve    → the approved request                (Validator)
 *   PUT  /vacation-requests/:id/reject     → the rejected request, body {comment} (Validator)
 *
 * Handlers stay thin: input parsers authenticate and validate, handlers dispatch a command
 * (writes) or call a query (reads). The user id always comes from `input.auth` (the JWT).
 */
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { Response } from "commoneventframework";
import { getCommandBus } from "../bootstrap";
import { getDataSource } from "../database/data-source";
import { UserRole } from "../modules/users/user.entity";
import { ApproveVacationRequestCommand } from "../modules/vacation-requests/commands/approve-vacation-request.command";
import { CreateVacationRequestCommand } from "../modules/vacation-requests/commands/create-vacation-request.command";
import { RejectVacationRequestCommand } from "../modules/vacation-requests/commands/reject-vacation-request.command";
import {
  listAllVacationRequests,
  listMyVacationRequests,
} from "../modules/vacation-requests/vacation-request.queries";
import {
  CreateVacationRequestInput,
  createVacationRequestSchema,
  ListVacationRequestsQuery,
  listVacationRequestsQuerySchema,
  RejectVacationRequestInput,
  rejectVacationRequestSchema,
  requestIdParamsSchema,
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

// --- GET /vacation-requests?status&userId&page&limit (Validator) ---

export const parseListAllVacationRequestsInput = protectedInputParser(
  [UserRole.Validator],
  (event: CommonEvent) => validate(listVacationRequestsQuerySchema, getQueryParams(event))
);

export const listAllRequests = withErrorHandling(
  async (input: AuthenticatedInput<ListVacationRequestsQuery>) => {
    const { auth, status, userId, ...pagination } = input;
    return listAllVacationRequests(await getDataSource(), { status, userId }, pagination);
  }
);

// --- PUT /vacation-requests/:id/approve (Validator) ---

export const parseApproveVacationRequestInput = protectedInputParser(
  [UserRole.Validator],
  (event: CommonEvent) => validate(requestIdParamsSchema, event.pathParameters ?? {})
);

export const approveVacationRequest = withErrorHandling(
  async (input: AuthenticatedInput<{ id: number }>) =>
    getCommandBus().execute(new ApproveVacationRequestCommand(input.id, input.auth.userId))
);

// --- PUT /vacation-requests/:id/reject (Validator), body { comment } ---

export const parseRejectVacationRequestInput = protectedInputParser(
  [UserRole.Validator],
  (event: CommonEvent) => {
    const params = validate(requestIdParamsSchema, event.pathParameters ?? {});
    if (params instanceof Response) return params;
    const body = parseJsonBody(event);
    if (body instanceof Response) return body;
    const data = validate(rejectVacationRequestSchema, body);
    if (data instanceof Response) return data;
    return { ...params, ...data };
  }
);

export const rejectVacationRequest = withErrorHandling(
  async (input: AuthenticatedInput<{ id: number } & RejectVacationRequestInput>) =>
    getCommandBus().execute(new RejectVacationRequestCommand(input.id, input.auth.userId, input.comment))
);
