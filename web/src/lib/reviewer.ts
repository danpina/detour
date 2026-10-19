/**
 * Reviewer mode: lets the content owner look through cards in the real app and send the bad ones back to the
 * review queue. It is hidden unless switched on with ?reviewer=1, and everything it stores stays on this device.
 * The exported list is read by `pnpm tools sendback`, which moves those cards out of the published set.
 */

export type SendBackReason = "wrong" | "image" | "writing" | "boring" | "other";

export const SEND_BACK_REASONS: [SendBackReason, string][] = [
  ["wrong", "Wrong or misleading"],
  ["image", "Bad or unfitting image"],
  ["writing", "Badly written or confusing"],
  ["boring", "Boring or low value"],
  ["other", "Something else"],
];

export type SendBackItem = { card_id: string; reason: SendBackReason; note?: string; at: number };

type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const REVIEWER_KEY = "detour.reviewer";
const LIST_KEY = "detour.sendback";
const SEEN_KEY = "detour.reviewerSeen";

function defaultStore(): KV | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function readJson<T>(kv: KV | null, key: string, fallback: T): T {
  try {
    const raw = kv?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(kv: KV | null, key: string, value: unknown): void {
  try {
    kv?.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the list just won't persist
  }
}

export function isReviewer(kv: KV | null = defaultStore()): boolean {
  try {
    return kv?.getItem(REVIEWER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setReviewer(on: boolean, kv: KV | null = defaultStore()): void {
  try {
    if (on) kv?.setItem(REVIEWER_KEY, "1");
    else kv?.removeItem(REVIEWER_KEY);
  } catch {
    // ignore
  }
}

/** ?reviewer=1 switches reviewer mode on, ?reviewer=0 switches it off. Anything else changes nothing. */
export function applyReviewerParam(search: string, kv: KV | null = defaultStore()): void {
  const v = new URLSearchParams(search).get("reviewer");
  if (v === "1") setReviewer(true, kv);
  if (v === "0") setReviewer(false, kv);
}

export function getSendBack(kv: KV | null = defaultStore()): SendBackItem[] {
  const list = readJson<SendBackItem[]>(kv, LIST_KEY, []);
  return Array.isArray(list) ? list.filter((i) => i && typeof i.card_id === "string") : [];
}

/** Adds (or replaces) a send-back entry for the card. */
export function sendBack(item: SendBackItem, kv: KV | null = defaultStore()): SendBackItem[] {
  const next = [...getSendBack(kv).filter((i) => i.card_id !== item.card_id), item];
  writeJson(kv, LIST_KEY, next);
  return next;
}

export function undoSendBack(cardId: string, kv: KV | null = defaultStore()): SendBackItem[] {
  const next = getSendBack(kv).filter((i) => i.card_id !== cardId);
  writeJson(kv, LIST_KEY, next);
  return next;
}

export function clearSendBack(kv: KV | null = defaultStore()): void {
  try {
    kv?.removeItem(LIST_KEY);
  } catch {
    // ignore
  }
}

/** The file you give to `pnpm tools sendback`. */
export function exportSendBack(items: SendBackItem[], now = Date.now()): string {
  return JSON.stringify({ app: "detour", kind: "send-back", version: 1, exported_at: now, items }, null, 2);
}

/** Cards already looked at in review mode, so the next batch shows new ones. */
export function seenInReview(kv: KV | null = defaultStore()): Set<string> {
  return new Set(readJson<string[]>(kv, SEEN_KEY, []));
}

export function markSeenInReview(cardId: string, kv: KV | null = defaultStore()): void {
  const seen = seenInReview(kv);
  if (seen.has(cardId)) return;
  seen.add(cardId);
  writeJson(kv, SEEN_KEY, [...seen]);
}

export function resetReviewProgress(kv: KV | null = defaultStore()): void {
  try {
    kv?.removeItem(SEEN_KEY);
  } catch {
    // ignore
  }
}
