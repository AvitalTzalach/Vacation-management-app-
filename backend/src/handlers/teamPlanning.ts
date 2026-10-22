/**
 * HTTP handlers for the team planning (routes declared in root.yaml).
 *
 *   GET /team-planning?from&to → approved absences overlapping the range (Requester and Validator)
 */
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { getDataSource } from "../database/data-source";
import { UserRole } from "../modules/users/user.entity";
import { getTeamPlanning } from "../modules/vacation-requests/vacation-request.queries";
import {
  TeamPlanningQuery,
  teamPlanningQuerySchema,
} from "../modules/vacation-requests/vacation-request.schemas";
import { AuthenticatedInput, protectedInputParser } from "./http/auth-guard";
import { withErrorHandling } from "./http/error-response";
import { getQueryParams, validate } from "./http/parse-input";

// --- GET /team-planning (both roles) ---

export const parseTeamPlanningInput = protectedInputParser(
  [UserRole.Requester, UserRole.Validator],
  (event: CommonEvent) => validate(teamPlanningQuerySchema, getQueryParams(event))
);

export const teamPlanning = withErrorHandling(async (input: AuthenticatedInput<TeamPlanningQuery>) =>
  getTeamPlanning(await getDataSource(), { from: input.from, to: input.to })
);
