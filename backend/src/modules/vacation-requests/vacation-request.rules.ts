/**
 * Business rules on vacation request dates, as pure functions.
 *
 * Pure = no database, no clock, no HTTP: every input is a parameter ("today" too), so each rule
 * can be unit-tested with plain values. Dates are "YYYY-MM-DD" strings, which compare correctly
 * with < and >.
 *
 * Rule 2 (no overlap) needs the database and is enforced in CreateVacationRequestHandler, using
 * the same inclusive definition as `rangesOverlap` below.
 */
import { FieldError, ValidationError } from "../../shared/errors";

export interface DateRange {
  startDate: string;
  endDate: string;
}

// Rule 1: the end date must be strictly after the start date (a same-day request is rejected).
export function isEndDateAfterStartDate({ startDate, endDate }: DateRange): boolean {
  return endDate > startDate;
}

// Rule 4: a request cannot start in the past. Starting today is allowed.
export function isStartDateInPast(startDate: string, today: string): boolean {
  return startDate < today;
}

/**
 * Rule 2 definition: two ranges overlap when they share at least one day.
 * Both ends are inclusive, so a request ending on the 10th overlaps one starting on the 10th.
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && a.endDate >= b.startDate;
}

/**
 * Checks rules 1 and 4 for a new request and throws a ValidationError listing every broken rule
 * (with the field it concerns, so the frontend can show the message next to the right input).
 */
export function assertValidNewRequestDates(range: DateRange, today: string): void {
  const errors: FieldError[] = [];
  if (isStartDateInPast(range.startDate, today)) {
    errors.push({ field: "startDate", message: "Start date cannot be in the past." });
  }
  if (!isEndDateAfterStartDate(range)) {
    errors.push({ field: "endDate", message: "End date must be after start date." });
  }
  if (errors.length > 0) {
    throw new ValidationError(errors[0].message, errors);
  }
}
