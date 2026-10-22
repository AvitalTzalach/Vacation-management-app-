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
