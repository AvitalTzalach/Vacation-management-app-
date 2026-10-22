/**
 * Validation schemas for vacation request input (shape and format only).
 *
 * Business rules (end after start, not in the past, no overlap) are NOT checked here: they live in
 * the business layer (vacation-request.rules.ts and the command handler), so they apply whatever
 * the entry point is.
 */
import { z } from "zod";
import { daysBetweenInclusive, isValidIsoDate, monthRange, todayIso } from "../../shared/dates";
import { paginationQuerySchema } from "../../shared/pagination";
import { VacationRequestStatus } from "./vacation-request.entity";

// Maximum length of the optional reason.
export const REASON_MAX_LENGTH = 500;

// A required calendar date in "YYYY-MM-DD" format.
function isoDate(label: string) {
  return z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be a string` })
    .refine(isValidIsoDate, `${label} must be a valid date (YYYY-MM-DD)`);
}

/**
 * Body of POST /vacation-requests.
 * `.strict()` rejects unknown fields: in particular, a `userId` in the body is refused —
 * the owner always comes from the JWT.
 * An empty or blank reason is stored as null.
 */
export const createVacationRequestSchema = z
  .object({
    startDate: isoDate("Start date"),
    endDate: isoDate("End date"),
    reason: z
      .string({ invalid_type_error: "Reason must be a string" })
      .trim()
      .max(REASON_MAX_LENGTH, `Reason must be ${REASON_MAX_LENGTH} characters or less`)
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .strict();

export type CreateVacationRequestInput = z.infer<typeof createVacationRequestSchema>;

// Maximum length of a validator's comment.
export const COMMENT_MAX_LENGTH = 1000;

// An empty query value ("?status=") means "no filter", like an absent one.
function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

/**
 * Query string of GET /vacation-requests (validator dashboard):
 * optional `status` and `userId` filters, plus page / limit.
 */
export const listVacationRequestsQuerySchema = paginationQuerySchema.extend({
  status: z.preprocess(
    emptyToUndefined,
    z
      .nativeEnum(VacationRequestStatus, {
        errorMap: () => ({ message: "status must be Pending, Approved or Rejected" }),
      })
      .optional()
  ),
  userId: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive("userId must be a positive integer").optional()
  ),
});

export type ListVacationRequestsQuery = z.infer<typeof listVacationRequestsQuerySchema>;

// Path parameter `:id` of /vacation-requests/:id/approve and /reject.
export const requestIdParamsSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: "id must be a number" })
    .int("id must be an integer")
    .positive("id must be a positive integer"),
});

/**
 * Body of PUT /vacation-requests/:id/reject. Rule 5: the comment is mandatory and cannot be
 * blank. The API field is `comment`; it is stored in the `comments` column.
 */
export const rejectVacationRequestSchema = z
  .object({
    comment: z
      .string({
        required_error: "A comment is required to reject a request.",
        invalid_type_error: "Comment must be a string",
      })
      .trim()
      .min(1, "A comment is required to reject a request.")
      .max(COMMENT_MAX_LENGTH, `Comment must be ${COMMENT_MAX_LENGTH} characters or less`),
  })
  .strict();

export type RejectVacationRequestInput = z.infer<typeof rejectVacationRequestSchema>;

// Longest range the team planning accepts (a little more than a year).
export const TEAM_PLANNING_MAX_DAYS = 366;

/**
 * Query string of GET /team-planning: an optional date range.
 * - none given → the current month (server date);
 * - both given → used as is, `from` must not be after `to`, at most 366 days;
 * - only one given → 400 (ambiguous).
 */
export const teamPlanningQuerySchema = z
  .object({
    from: z.preprocess(emptyToUndefined, isoDate("from").optional()),
    to: z.preprocess(emptyToUndefined, isoDate("to").optional()),
  })
  .superRefine((value, ctx) => {
    if (Boolean(value.from) !== Boolean(value.to)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["from"], message: "from and to must be given together" });
      return;
    }
    if (value.from && value.to) {
      if (value.from > value.to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "to must be on or after from" });
      } else if (daysBetweenInclusive(value.from, value.to) > TEAM_PLANNING_MAX_DAYS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["to"],
          message: `The range cannot exceed ${TEAM_PLANNING_MAX_DAYS} days`,
        });
      }
    }
  })
  .transform((value) => (value.from && value.to ? { from: value.from, to: value.to } : monthRange(todayIso())));

export type TeamPlanningQuery = z.infer<typeof teamPlanningQuerySchema>;
