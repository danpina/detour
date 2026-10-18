import { describe, expect, it } from "vitest";
import { BACKUP_EVERY_DAYS, shouldNudgeBackup } from "./home";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 20);

describe("backup nudge", () => {
  it("stays quiet until there is something worth keeping", () => {
    expect(shouldNudgeBackup(0, undefined, now)).toBe(false);
    expect(shouldNudgeBackup(2, undefined, now)).toBe(false);
  });
  it("asks once there are sessions and no backup yet", () => {
    expect(shouldNudgeBackup(3, undefined, now)).toBe(true);
  });
  it("stays quiet after a recent backup and returns after two weeks", () => {
    expect(shouldNudgeBackup(20, now - 3 * DAY, now)).toBe(false);
    expect(shouldNudgeBackup(20, now - BACKUP_EVERY_DAYS * DAY, now)).toBe(true);
  });
});

import { shouldShowRecap } from "./home";
import { dayKey, weekKey } from "./progress";

describe("weekly recap prompt", () => {
  const sunday = new Date(2026, 9, 18, 12).getTime(); // Sunday 18 Oct 2026
  const wednesday = new Date(2026, 9, 21, 12).getTime();
  it("appears on Sunday and Monday only", () => {
    expect(shouldShowRecap(sunday, 5, null)).toBe(true);
    expect(shouldShowRecap(sunday + 86_400_000, 5, null)).toBe(true);
    expect(shouldShowRecap(wednesday, 5, null)).toBe(false);
  });
  it("needs something to show and goes away once seen", () => {
    expect(shouldShowRecap(sunday, 0, null)).toBe(false);
    expect(shouldShowRecap(sunday, 5, weekKey(dayKey(sunday)))).toBe(false);
    expect(shouldShowRecap(sunday, 5, "2026-10-05")).toBe(true);
  });
});
