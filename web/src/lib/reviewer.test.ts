import { describe, expect, it } from "vitest";
import {
  applyReviewerParam, clearSendBack, exportSendBack, getSendBack, isReviewer, markSeenInReview, seenInReview, sendBack, setReviewer, undoSendBack,
} from "./reviewer";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe("reviewer mode", () => {
  it("is off until switched on with ?reviewer=1, and off again with ?reviewer=0", () => {
    const kv = memory();
    expect(isReviewer(kv)).toBe(false);
    applyReviewerParam("?foo=1", kv);
    expect(isReviewer(kv)).toBe(false);
    applyReviewerParam("?reviewer=1", kv);
    expect(isReviewer(kv)).toBe(true);
    applyReviewerParam("?reviewer=0", kv);
    expect(isReviewer(kv)).toBe(false);
    setReviewer(true, kv);
    expect(isReviewer(kv)).toBe(true);
  });

  it("keeps one entry per card, newest reason wins, and can undo", () => {
    const kv = memory();
    sendBack({ card_id: "sci-0001", reason: "image", at: 1 }, kv);
    sendBack({ card_id: "hist-0002", reason: "wrong", note: "date is off", at: 2 }, kv);
    sendBack({ card_id: "sci-0001", reason: "boring", at: 3 }, kv);
    const list = getSendBack(kv);
    expect(list.map((i) => `${i.card_id}:${i.reason}`).sort()).toEqual(["hist-0002:wrong", "sci-0001:boring"]);
    expect(undoSendBack("hist-0002", kv).map((i) => i.card_id)).toEqual(["sci-0001"]);
    clearSendBack(kv);
    expect(getSendBack(kv)).toEqual([]);
  });

  it("survives corrupted storage and missing storage", () => {
    const kv = memory();
    kv.setItem("detour.sendback", "{not json");
    expect(getSendBack(kv)).toEqual([]);
    expect(getSendBack(null)).toEqual([]);
    expect(isReviewer(null)).toBe(false);
    expect(() => sendBack({ card_id: "x-0001", reason: "other", at: 1 }, null)).not.toThrow();
  });

  it("exports the file that the send-back tool reads", () => {
    const text = exportSendBack([{ card_id: "sci-0001", reason: "image", at: 5 }], 99);
    expect(JSON.parse(text)).toEqual({ app: "detour", kind: "send-back", version: 1, exported_at: 99, items: [{ card_id: "sci-0001", reason: "image", at: 5 }] });
  });

  it("remembers which cards were already looked at", () => {
    const kv = memory();
    markSeenInReview("a-0001", kv);
    markSeenInReview("a-0001", kv);
    markSeenInReview("b-0002", kv);
    expect([...seenInReview(kv)].sort()).toEqual(["a-0001", "b-0002"]);
  });
});
