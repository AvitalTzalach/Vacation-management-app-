/**
 * Read-side queries of the vacation-requests module.
 *
 * Reads change nothing and publish no event, so they do not go through the CommandBus:
 * they are plain functions returning API-ready data (light CQRS: commands write, queries read).
 */
import { DataSource } from "typeorm";
import { PaginatedResult, PaginationQuery, toPaginatedResult, toSkipTake } from "../../shared/pagination";
import { toVacationRequestDto, VacationRequestDto } from "./vacation-request.dto";
import { VacationRequest } from "./vacation-request.entity";

/**
 * Lists the requests of one user, newest first, one page at a time.
 * Ordered by created_at DESC, then id DESC as a tie-breaker so pages stay stable when two rows
 * share the same created_at. Served by the index (user_id, created_at, id).
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
