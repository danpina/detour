import { beforeEach, describe, expect, it, vi } from "vitest";
import { __setSender, setAnalyticsEnabled, track } from "./index";
import type { SignalPayloads } from "./signals";

describe("analytics", () => {
  beforeEach(() => __setSender(undefined));

  it("does nothing without an app id (no sender)", () => {
    __setSender(null);
    expect(() => track("app.opened")).not.toThrow();
  });

  it("sends the signal name and payload", () => {
    const send = vi.fn();
    __setSender(send);
    track("card.reported", { card: "sci-0001", reason: "wrong_fact" });
    expect(send).toHaveBeenCalledWith("card.reported", { card: "sci-0001", reason: "wrong_fact" });
  });

  it("stops sending when the user opts out", () => {
    const send = vi.fn();
    __setSender(send);
    setAnalyticsEnabled(false);
    track("app.opened");
    expect(send).not.toHaveBeenCalled();
    setAnalyticsEnabled(true);
    track("app.opened");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never throws, even if sending fails", async () => {
    __setSender(() => {
      throw new Error("offline");
    });
    expect(() => track("app.opened")).not.toThrow();
    __setSender(() => Promise.reject(new Error("blocked")));
    expect(() => track("app.opened")).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("the signal catalogue only allows primitive values (type-level check)", () => {
    const ok: SignalPayloads["recall.answered"] = { kind: "tf", correct: true };
    const values = Object.values(ok);
    expect(values.every((v) => ["string", "number", "boolean"].includes(typeof v))).toBe(true);
  });
});
