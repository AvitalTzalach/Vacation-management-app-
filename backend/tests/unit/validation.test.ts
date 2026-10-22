/**
 * Unit tests of input validation: pagination and the vacation request schemas.
 */
import { describe, expect, it } from "vitest";
import { paginationQuerySchema, toPaginatedResult, toSkipTake } from "../../src/shared/pagination";
import { monthRange, todayIso } from "../../src/shared/dates";
import {
  createVacationRequestSchema,
  listVacationRequestsQuerySchema,
  rejectVacationRequestSchema,
  requestIdParamsSchema,
  teamPlanningQuerySchema,
} from "../../src/modules/vacation-requests/vacation-request.schemas";

describe("pagination", () => {
  it("uses page 1 and limit 10 by default", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it("converts query strings to numbers", () => {
    expect(paginationQuerySchema.parse({ page: "3", limit: "5" })).toEqual({ page: 3, limit: 5 });
  });

  it.each([{ page: "0" }, { limit: "51" }, { limit: "0" }, { page: "abc" }, { page: "1.5" }])(
    "rejects %j",
    (query) => {
      expect(paginationQuerySchema.safeParse(query).success).toBe(false);
    }
  );

  it("computes offset and page count", () => {
    expect(toSkipTake({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
    expect(toPaginatedResult([], 25, { page: 1, limit: 10 }).meta.totalPages).toBe(3);
    expect(toPaginatedResult([], 0, { page: 1, limit: 10 }).meta.totalPages).toBe(0);
  });
});

describe("createVacationRequestSchema", () => {
  it("accepts valid input and stores a blank reason as null", () => {
    expect(createVacationRequestSchema.parse({ startDate: "2030-01-01", endDate: "2030-01-03", reason: "  " })).toEqual({
      startDate: "2030-01-01",
      endDate: "2030-01-03",
      reason: null,
    });
  });

  it("trims the reason", () => {
    expect(
      createVacationRequestSchema.parse({ startDate: "2030-01-01", endDate: "2030-01-03", reason: " Trip " }).reason
    ).toBe("Trip");
  });

  it("requires both dates", () => {
    const result = createVacationRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(["startDate", "endDate"]);
  });

  it("refuses a userId in the body (the owner always comes from the token)", () => {
    expect(
      createVacationRequestSchema.safeParse({ startDate: "2030-01-01", endDate: "2030-01-03", userId: 7 }).success
    ).toBe(false);
  });

  it("refuses an impossible date", () => {
    expect(createVacationRequestSchema.safeParse({ startDate: "2030-02-30", endDate: "2030-03-03" }).success).toBe(false);
  });
});

describe("rejectVacationRequestSchema (rule 5 at the input level)", () => {
  it("trims the comment", () => {
    expect(rejectVacationRequestSchema.parse({ comment: "  Busy week  " })).toEqual({ comment: "Busy week" });
  });

  it.each([{}, { comment: "" }, { comment: "   " }])("rejects %j", (body) => {
    expect(rejectVacationRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("dashboard filters and ids", () => {
  it("treats empty filters as no filter", () => {
    expect(listVacationRequestsQuerySchema.parse({ status: "", userId: "" })).toEqual({ page: 1, limit: 10 });
  });

  it("parses status and userId", () => {
    expect(listVacationRequestsQuerySchema.parse({ status: "Pending", userId: "4" })).toMatchObject({
      status: "Pending",
      userId: 4,
    });
  });

  it("rejects an unknown status", () => {
    expect(listVacationRequestsQuerySchema.safeParse({ status: "Cancelled" }).success).toBe(false);
  });

  it("parses a positive integer id only", () => {
    expect(requestIdParamsSchema.parse({ id: "12" })).toEqual({ id: 12 });
    expect(requestIdParamsSchema.safeParse({ id: "abc" }).success).toBe(false);
    expect(requestIdParamsSchema.safeParse({ id: "-1" }).success).toBe(false);
  });
});

describe("teamPlanningQuerySchema", () => {
  it("defaults to the current month", () => {
    expect(teamPlanningQuerySchema.parse({})).toEqual(monthRange(todayIso()));
  });

  it("keeps an explicit range", () => {
    expect(teamPlanningQuerySchema.parse({ from: "2030-01-01", to: "2030-01-31" })).toEqual({
      from: "2030-01-01",
      to: "2030-01-31",
    });
  });

  it.each([
    { from: "2030-01-01" },
    { from: "2030-02-01", to: "2030-01-01" },
    { from: "2030-01-01", to: "2031-06-01" },
  ])("rejects %j", (query) => {
    expect(teamPlanningQuerySchema.safeParse(query).success).toBe(false);
  });
});
