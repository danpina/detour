/**
 * A daily reminder as a calendar file (.ics). It needs no accounts, no server and no push permission:
 * the user's own calendar app does the reminding. The time is "floating", so it follows the phone's timezone.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Escapes text values per RFC 5545. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildReminderIcs(opts: { hour: number; minute: number; url: string; now?: Date }): string {
  const now = opts.now ?? new Date();
  const hour = Math.min(23, Math.max(0, Math.floor(opts.hour)));
  const minute = Math.min(59, Math.max(0, Math.floor(opts.minute)));
  const start = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(hour)}${pad(minute)}00`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Detour//Daily reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:detour-daily-${hour}${pad(minute)}@detour`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${start}`,
    "DURATION:PT5M",
    "RRULE:FREQ=DAILY",
    `SUMMARY:${esc("Detour: a quick one?")}`,
    `DESCRIPTION:${esc(`Five small cards, about a minute. ${opts.url}`)}`,
    `URL:${opts.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc("Detour: a quick one?")}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/** "20:30" -> { hour: 20, minute: 30 }. Falls back to 20:00 for anything unreadable. */
export function parseTime(value: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return { hour: 20, minute: 0 };
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : { hour: 20, minute: 0 };
}
