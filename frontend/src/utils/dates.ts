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
