/**
 * Unit tests of the "YYYY-MM-DD" date helpers.
 */
import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetweenInclusive,
  isValidIsoDate,
  monthRange,
  toIsoDate,
} from "../../src/shared/dates";

describe("isValidIsoDate", () => {
  it("accepts real dates", () => {
    expect(isValidIsoDate("2030-01-31")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects impossible dates", () => {
    expect(isValidIsoDate("2030-02-30")).toBe(false);
    expect(isValidIsoDate("2030-02-29")).toBe(false);
    expect(isValidIsoDate("2030-13-01")).toBe(false);
  });

  it("rejects other formats", () => {
    expect(isValidIsoDate("30-01-2030")).toBe(false);
    expect(isValidIsoDate("2030-1-5")).toBe(false);
    expect(isValidIsoDate("2030-01-05T00:00:00Z")).toBe(false);
  });
});

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2030-05-10", 3)).toBe("2030-05-13");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(addDays("2030-12-31", 1)).toBe("2031-01-01");
  });

  it("subtracts days", () => {
    expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
  });
});

describe("monthRange and daysBetweenInclusive", () => {
  it("returns the first and last day of a month", () => {
    expect(monthRange("2030-04-17")).toEqual({ from: "2030-04-01", to: "2030-04-30" });
    expect(monthRange("2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("counts days with both ends included", () => {
    expect(daysBetweenInclusive("2030-10-01", "2030-10-31")).toBe(31);
    expect(daysBetweenInclusive("2030-10-01", "2030-10-01")).toBe(1);
  });
});

describe("toIsoDate", () => {
  it("formats a local date with zero padding", () => {
    expect(toIsoDate(new Date(2030, 0, 5, 12))).toBe("2030-01-05");
  });
});
