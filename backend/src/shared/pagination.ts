/**
 * Pagination helpers shared by every list endpoint.
 *
 * Query string: `?page=1&limit=10` (page starts at 1, limit capped at 50).
 * Response:     `{ data: [...], meta: { page, limit, total, totalPages } }`.
 */
import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

// Validates `page` and `limit` from the query string (strings are coerced to numbers).
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, "page must be 1 or more").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "limit must be 1 or more")
    .max(MAX_PAGE_SIZE, `limit must be ${MAX_PAGE_SIZE} or less`)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Converts page/limit into the offset/count used by SQL (TypeORM `skip` / `take`).
export function toSkipTake({ page, limit }: PaginationQuery): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

// Builds the paginated response from one page of rows and the total row count.
export function toPaginatedResult<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationQuery
): PaginatedResult<T> {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
