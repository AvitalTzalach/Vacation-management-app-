/**
 * Date helpers for calendar dates written as "YYYY-MM-DD" (the API format).
 *
 * Dates are rebuilt from their parts at local noon instead of `new Date("YYYY-MM-DD")`,
 * which would parse them as UTC midnight and could display the previous day in some time zones.
 */

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// "YYYY-MM-DD" → local Date at noon.
function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

// Local Date → "YYYY-MM-DD".
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Today's date in the user's time zone, "YYYY-MM-DD".
export function todayIso(): string {
  return toIsoDate(new Date());
}

// Adds (or subtracts) days to a "YYYY-MM-DD" date.
export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

// --- Months, written "YYYY-MM" ---

// Current month, "YYYY-MM".
export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

// True for a valid "YYYY-MM" value.
export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// "2026-10" plus 1 → "2026-11"; minus 1 → "2026-09" (handles year changes).
export function addMonths(month: string, count: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + count, 1, 12);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

// Number of days in a month ("2026-02" → 28).
export function daysInMonth(month: string): number {
  const [year, monthIndex] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this month.
  return new Date(year, monthIndex, 0, 12).getDate();
}

// First and last day of a month, "YYYY-MM-DD".
export function monthBounds(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${month}-${pad2(daysInMonth(month))}` };
}

// "2026-10" → "October 2026".
export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(parseIsoDate(`${month}-01`));
}

const displayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// "2026-12-21" → "21 Dec 2026".
export function formatDate(isoDate: string): string {
  return displayFormat.format(parseIsoDate(isoDate));
}

// Number of calendar days in a request, both ends included ("21 → 23 Dec" = 3 days).
export function countDays(startDate: string, endDate: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseIsoDate(endDate).getTime() - parseIsoDate(startDate).getTime()) / msPerDay) + 1;
}
