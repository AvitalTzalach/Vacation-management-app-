/**
 * Read-side queries of the vacation-requests module.
 *
 * Reads change nothing and publish no event, so they do not go through the CommandBus:
 * they are plain functions returning API-ready data (light CQRS: commands write, queries read).
 *
 * Every list is ordered by created_at DESC, then id DESC as a tie-breaker, so pages stay stable
 * when two rows share the same created_at.
 */
import { DataSource } from "typeorm";
import { PaginatedResult, PaginationQuery, toPaginatedResult, toSkipTake } from "../../shared/pagination";
import {
  toVacationRequestDto,
  toVacationRequestWithUserDto,
  VacationRequestDto,
  VacationRequestWithUserDto,
} from "./vacation-request.dto";
import { VacationRequest, VacationRequestStatus } from "./vacation-request.entity";

/**
 * Lists the requests of one user, newest first, one page at a time.
 * Served by the index (user_id, created_at, id).
 */
export async function listMyVacationRequests(
  dataSource: DataSource,
  userId: number,
  pagination: PaginationQuery
): Promise<PaginatedResult<VacationRequestDto>> {
  const [rows, total] = await dataSource.getRepository(VacationRequest).findAndCount({
    where: { userId },
    order: { createdAt: "DESC", id: "DESC" },
    ...toSkipTake(pagination),
  });

  return toPaginatedResult(rows.map(toVacationRequestDto), total, pagination);
}

// One approved absence in the team planning. Deliberately minimal: no reason, no comment.
export interface TeamPlanningEntryDto {
  userId: number;
  userName: string;
  startDate: string;
  endDate: string;
}

export interface TeamPlanningDto {
  // The range actually used (the current month when none was given).
  from: string;
  to: string;
  data: TeamPlanningEntryDto[];
}

/**
 * Team planning (both roles): Approved requests that overlap [from, to], sorted by employee
 * name then start date. Only the owner and the dates are selected — never `reason` or `comments`,
 * which are private to the requester and the validators.
 * Overlap uses the same inclusive rule as rule 2: start_date <= to AND end_date >= from.
 */
export async function getTeamPlanning(
  dataSource: DataSource,
  range: { from: string; to: string }
): Promise<TeamPlanningDto> {
  const rows = await dataSource
    .getRepository(VacationRequest)
    .createQueryBuilder("request")
    .innerJoin("request.user", "user")
    .select([
      "request.user_id AS user_id",
      "user.name AS user_name",
      "request.start_date AS start_date",
      "request.end_date AS end_date",
    ])
    .where("request.status = :approved", { approved: VacationRequestStatus.Approved })
    .andWhere("request.start_date <= :to", { to: range.to })
    .andWhere("request.end_date >= :from", { from: range.from })
    .orderBy("user.name", "ASC")
    .addOrderBy("request.start_date", "ASC")
    .getRawMany<{ user_id: number; user_name: string; start_date: string; end_date: string }>();

  return {
    ...range,
    data: rows.map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      startDate: row.start_date,
      endDate: row.end_date,
    })),
  };
}

export interface VacationRequestFilters {
  status?: VacationRequestStatus;
  userId?: number;
}

/**
 * Lists all requests for the validator dashboard, with optional status / user filters.
 *
 * The owner's id and name are loaded in the SAME query with an inner join (no N+1: one query for
 * the page + one COUNT query, whatever the page size). Only `id` and `name` are selected from
 * `users`, never the email or the password.
 *
 * Indexes: (status, created_at, id) for a status filter, (user_id, created_at, id) for a user filter.
 * `offset` / `limit` are used instead of `skip` / `take`: the join is many-to-one (one user per
 * request), so rows are not multiplied and plain SQL LIMIT / OFFSET is correct and cheaper.
 */
export async function listAllVacationRequests(
  dataSource: DataSource,
  filters: VacationRequestFilters,
  pagination: PaginationQuery
): Promise<PaginatedResult<VacationRequestWithUserDto>> {
  const query = dataSource
    .getRepository(VacationRequest)
    .createQueryBuilder("request")
    .innerJoin("request.user", "user")
    .addSelect(["user.id", "user.name"]);

  if (filters.status) {
    query.andWhere("request.status = :status", { status: filters.status });
  }
  if (filters.userId) {
    query.andWhere("request.user_id = :userId", { userId: filters.userId });
  }

  const { skip, take } = toSkipTake(pagination);
  const [rows, total] = await query
    .orderBy("request.created_at", "DESC")
    .addOrderBy("request.id", "DESC")
    .offset(skip)
    .limit(take)
    .getManyAndCount();

  return toPaginatedResult(rows.map(toVacationRequestWithUserDto), total, pagination);
}
