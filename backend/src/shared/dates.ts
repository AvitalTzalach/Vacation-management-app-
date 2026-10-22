/**
 * Date helpers working on calendar dates as "YYYY-MM-DD" strings.
 *
 * Vacation dates have no time and no time zone (PostgreSQL `date`), so the whole backend
 * handles them as ISO strings. Strings in this format compare correctly with < and >,
 * which keeps the business rules simple.
 */

// Pads a number to two digits ("7" → "07").
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// Formats a JS Date as "YYYY-MM-DD" using the server's local calendar day.
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * True when the value is a real calendar date written as "YYYY-MM-DD".
 * Rejects wrong formats and impossible dates such as "2026-02-30".
 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// Today's date on the server, as "YYYY-MM-DD" (used by business rule 4: no past requests).
export function todayIso(): string {
  return toIsoDate(new Date());
}

// First and last day of the month containing the given "YYYY-MM-DD" date.
export function monthRange(isoDate: string): { from: string; to: string } {
  const [year, month] = isoDate.split("-").map(Number);
  // Day 0 of the next month is the last day of this month.
  const lastDay = new Date(year, month, 0, 12).getDate();
  return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(lastDay)}` };
}

// Number of days from `from` to `to`, both included ("2026-10-01".."2026-10-31" → 31).
export function daysBetweenInclusive(from: string, to: string): number {
  const toNoon = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 12).getTime();
  };
  return Math.round((toNoon(to) - toNoon(from)) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Adds a number of days (can be negative) to a "YYYY-MM-DD" date.
 * Works at noon local time so a daylight-saving change can never move the result to another day.
 */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}
