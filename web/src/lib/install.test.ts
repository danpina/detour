import { describe, expect, it } from "vitest";
import { installHint } from "./install";

const base = { installed: false, dismissed: false, sessions: 2, canPrompt: false, ios: false };

describe("install hint", () => {
  it("waits until the user has finished a set", () => {
    expect(installHint({ ...base, sessions: 0, canPrompt: true })).toBeNull();
  });
  it("offers the browser prompt when available", () => {
    expect(installHint({ ...base, canPrompt: true })).toBe("prompt");
  });
  it("shows Add to Home Screen steps on iOS", () => {
    expect(installHint({ ...base, ios: true })).toBe("ios");
  });
  it("stays quiet when installed, dismissed, or nothing can be offered", () => {
    expect(installHint({ ...base, installed: true, canPrompt: true })).toBeNull();
    expect(installHint({ ...base, dismissed: true, ios: true })).toBeNull();
    expect(installHint(base)).toBeNull();
  });
});
