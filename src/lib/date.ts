export const TZ = "America/New_York";

/**
 * Everything in this app is anchored to New York, never to the device clock.
 * These helpers all go through Intl so there is no dependency and no DST math.
 */

/** "YYYY-MM-DD" for the given instant in New York. */
export function nyDay(at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the Postgres date literal.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** "3:04 PM" in New York. */
export function nyTime(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** "Thursday, September 4" */
export function nyLongDate(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(dayToUtcDate(day));
}

/** "Thu Sep 4" — no comma, so it reads cleanly inside the email subject. */
export function nyShortDate(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  })
    .format(dayToUtcDate(day))
    .replace(/,/g, "");
}

/**
 * A "YYYY-MM-DD" day string as a Date pinned to UTC midnight. Day strings are
 * calendar labels, not instants, so all arithmetic on them happens in UTC where
 * every day is exactly 24 hours long. Never render one in a local timezone.
 */
export function dayToUtcDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcDateToDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Shift a day string by n calendar days. */
export function addDays(day: string, n: number): string {
  const d = dayToUtcDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return utcDateToDay(d);
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(day: string): number {
  return dayToUtcDate(day).getUTCDay();
}

export function isWeekend(day: string): boolean {
  const w = dayOfWeek(day);
  return w === 0 || w === 6;
}

/** The Monday of the week containing `day`. */
export function mondayOf(day: string): string {
  const w = dayOfWeek(day);
  // Sunday (0) belongs to the week that started six days earlier.
  const back = w === 0 ? 6 : w - 1;
  return addDays(day, -back);
}

/** Mon..Sun day strings for the week containing `day`. */
export function weekDays(day: string): string[] {
  const mon = mondayOf(day);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}
