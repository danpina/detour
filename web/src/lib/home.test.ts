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
