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

// Today's date on the server, as "YYYY-MM-DD" (used by business rule 4: no past requests).
export function todayIso(): string {
  return toIsoDate(new Date());
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
