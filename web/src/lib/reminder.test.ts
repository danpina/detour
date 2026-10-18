import { describe, expect, it } from "vitest";
import { buildReminderIcs, parseTime } from "./reminder";

const now = new Date(2026, 9, 18, 9, 30, 0);

describe("daily reminder file", () => {
  const ics = buildReminderIcs({ hour: 20, minute: 15, url: "https://example.com/detour/", now });

  it("is a valid-looking recurring calendar event", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("DTSTART:20261018T201500");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("URL:https://example.com/detour/");
  });

  it("uses CRLF line endings and short lines", () => {
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(ics.includes("\n") && !/[^\r]\n/.test(ics)).toBe(true);
  });

  it("escapes commas and clamps the time", () => {
    const odd = buildReminderIcs({ hour: 99, minute: -5, url: "https://example.com/", now });
    expect(odd).toContain("DTSTART:20261018T230000");
    expect(odd).toContain("Detour: a quick one?");
  });

  it("parses times from an input", () => {
    expect(parseTime("07:05")).toEqual({ hour: 7, minute: 5 });
    expect(parseTime("25:00")).toEqual({ hour: 20, minute: 0 });
    expect(parseTime("nope")).toEqual({ hour: 20, minute: 0 });
  });
});
