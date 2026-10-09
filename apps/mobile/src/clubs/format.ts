// Dates in the reader's own locale and time zone.

/** "2026-10-20" as a local calendar date (not midnight UTC, which can be the day before). */
export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Today as YYYY-MM-DD in the reader's time zone. */
export function todayLocal(now = new Date()): string {
  return toLocalDateString(now);
}

export function toLocalDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A local date and time from the form, as an ISO timestamp with the offset (what the API stores). */
export function localDateTimeToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, min] = time.split(':').map(Number);
  const d = parseLocalDate(date);
  d.setHours(h ?? 0, min ?? 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDate(isoDate: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parseLocalDate(isoDate));
}

export function formatMeetingTime(isoDateTime: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(isoDateTime),
  );
}
