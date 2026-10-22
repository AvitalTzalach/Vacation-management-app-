/**
 * Unit tests of the pure business rules (rules 1, 2, 4 and 5). No database, no clock:
 * "today" is always passed explicitly.
 */
import { describe, expect, it } from "vitest";
import { ValidationError } from "../../src/shared/errors";
import {
  assertValidNewRequestDates,
  assertValidRejectionComment,
  isEndDateAfterStartDate,
  isStartDateInPast,
  isValidRejectionComment,
  rangesOverlap,
} from "../../src/modules/vacation-requests/vacation-request.rules";

// Runs `fn` and returns the ValidationError it throws (fails the test otherwise).
function catchValidationError(fn: () => void): ValidationError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return error as ValidationError;
  }
  throw new Error("Expected a ValidationError");
}

describe("rule 1 — end date must be after start date", () => {
  it("accepts an end date after the start date", () => {
    expect(isEndDateAfterStartDate({ startDate: "2030-05-10", endDate: "2030-05-11" })).toBe(true);
  });

  it("rejects the same day (strictly after)", () => {
    expect(isEndDateAfterStartDate({ startDate: "2030-05-10", endDate: "2030-05-10" })).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    expect(isEndDateAfterStartDate({ startDate: "2030-05-10", endDate: "2030-05-09" })).toBe(false);
  });

  it("compares across months and years", () => {
    expect(isEndDateAfterStartDate({ startDate: "2030-12-31", endDate: "2031-01-01" })).toBe(true);
  });
});

describe("rule 4 — no requests in the past", () => {
  const today = "2030-06-15";

  it("flags a start date before today", () => {
    expect(isStartDateInPast("2030-06-14", today)).toBe(true);
  });

  it("allows a start date today", () => {
    expect(isStartDateInPast("2030-06-15", today)).toBe(false);
  });

  it("allows a start date in the future", () => {
    expect(isStartDateInPast("2030-06-16", today)).toBe(false);
  });
});

describe("rule 2 — overlap definition (inclusive)", () => {
  const base = { startDate: "2030-03-10", endDate: "2030-03-15" };

  it("detects ranges sharing several days", () => {
    expect(rangesOverlap(base, { startDate: "2030-03-12", endDate: "2030-03-20" })).toBe(true);
  });

  it("counts a shared last/first day as an overlap", () => {
    expect(rangesOverlap(base, { startDate: "2030-03-15", endDate: "2030-03-18" })).toBe(true);
    expect(rangesOverlap(base, { startDate: "2030-03-05", endDate: "2030-03-10" })).toBe(true);
  });

  it("detects a range fully inside another", () => {
    expect(rangesOverlap(base, { startDate: "2030-03-11", endDate: "2030-03-12" })).toBe(true);
    expect(rangesOverlap({ startDate: "2030-03-11", endDate: "2030-03-12" }, base)).toBe(true);
  });

  it("does not flag adjacent ranges (next day)", () => {
    expect(rangesOverlap(base, { startDate: "2030-03-16", endDate: "2030-03-20" })).toBe(false);
    expect(rangesOverlap(base, { startDate: "2030-03-01", endDate: "2030-03-09" })).toBe(false);
  });
});

describe("assertValidNewRequestDates — rules 1 and 4 together", () => {
  const today = "2030-06-15";

  it("does not throw for valid dates", () => {
    expect(() => assertValidNewRequestDates({ startDate: "2030-06-15", endDate: "2030-06-16" }, today)).not.toThrow();
  });

  it("reports a past start date on the startDate field", () => {
    const error = catchValidationError(() =>
      assertValidNewRequestDates({ startDate: "2030-06-01", endDate: "2030-06-20" }, today)
    );
    expect(error.details).toEqual([{ field: "startDate", message: "Start date cannot be in the past." }]);
  });

  it("reports a same-day request on the endDate field", () => {
    const error = catchValidationError(() =>
      assertValidNewRequestDates({ startDate: "2030-06-20", endDate: "2030-06-20" }, today)
    );
    expect(error.message).toBe("End date must be after start date.");
    expect(error.details).toEqual([{ field: "endDate", message: "End date must be after start date." }]);
  });

  it("reports both problems at once", () => {
    const error = catchValidationError(() =>
      assertValidNewRequestDates({ startDate: "2030-06-01", endDate: "2030-05-30" }, today)
    );
    expect(error.details).toHaveLength(2);
    expect(error.message).toBe("Start date cannot be in the past.");
  });
});

describe("rule 5 — a rejection needs a comment", () => {
  it.each([null, undefined, "", "   ", "\n\t"])("rejects %j", (comment) => {
    expect(isValidRejectionComment(comment)).toBe(false);
  });

  it("accepts a comment with text", () => {
    expect(isValidRejectionComment("Release week")).toBe(true);
  });

  it("throws a ValidationError on the comment field", () => {
    const error = catchValidationError(() => assertValidRejectionComment("  "));
    expect(error.details).toEqual([{ field: "comment", message: "A comment is required to reject a request." }]);
  });

  it("does not throw for a valid comment", () => {
    expect(() => assertValidRejectionComment("Busy week")).not.toThrow();
  });
});
