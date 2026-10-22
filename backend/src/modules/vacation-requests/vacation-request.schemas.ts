/**
 * Validation schemas for vacation request input (shape and format only).
 *
 * Business rules (end after start, not in the past, no overlap) are NOT checked here: they live in
 * the business layer (vacation-request.rules.ts and the command handler), so they apply whatever
 * the entry point is.
 */
import { z } from "zod";
import { isValidIsoDate } from "../../shared/dates";

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
