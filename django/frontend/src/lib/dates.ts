const tz = "Africa/Johannesburg";

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-ZA", { timeZone: tz, ...opts });
const dayMonth = fmt({ day: "numeric", month: "short" });
const longDay = fmt({ weekday: "long", day: "numeric", month: "long" });
const weekdayShort = fmt({ weekday: "short" });
const timeOnly = fmt({ hour: "2-digit", minute: "2-digit" });
const monthYear = fmt({ month: "long", year: "numeric" });
const monthShort = fmt({ month: "short" });

/** "2026-11-18" is a calendar date: parse it at local noon so no time zone can move it a day. */
const asDate = (iso: string) => (iso.length === 10 ? new Date(`${iso}T12:00:00+02:00`) : new Date(iso));

export const formatDayMonth = (iso: string) => dayMonth.format(asDate(iso));
export const formatLongDay = (iso: string) => longDay.format(asDate(iso));
export const formatWeekday = (iso: string) => weekdayShort.format(asDate(iso));
export const formatTime = (iso: string) => timeOnly.format(asDate(iso));
export const formatMonthYear = (iso: string) => monthYear.format(asDate(iso));
export const formatMonthShort = (iso: string) => monthShort.format(asDate(iso));
export const formatDateTime = (iso: string) => `${formatDayMonth(iso)}, ${formatTime(iso)}`;

/** Today's date in Johannesburg as "YYYY-MM-DD" (for date inputs). */
export function todayIso(): string {
  const parts = fmt({ year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** An ISO datetime → the value a <input type="datetime-local"> wants, in Johannesburg time. */
export function toLocalInput(iso: string): string {
  const parts = fmt({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** "Overdue by 2 days", "Due today", "Due in 3 days" relative to `today` (both YYYY-MM-DD). */
export function dueText(due: string, today: string): string {
  const days = Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}
