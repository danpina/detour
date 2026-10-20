export type Scale = "linear" | "log";

/**
 * 0..1 closeness of a guess to the answer. Log scale compares ratios (10x too big or too small scores 0, whatever the
 * slider's range is), linear compares differences against the slider's range.
 */
export function closeness(guess: number, answer: number, min: number, max: number, scale: Scale): number {
  if (scale === "log" && guess > 0 && answer > 0 && min > 0) {
    return clamp01(1 - Math.abs(Math.log10(guess / answer)));
  }
  return clamp01(1 - Math.abs(guess - answer) / (max - min));
}

export function closenessLabel(c: number): string {
  if (c >= 0.97) return "Spot on";
  if (c >= 0.85) return "Very close";
  if (c >= 0.65) return "In the ballpark";
  return "Not quite, but now you know";
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Slider position (0..1) <-> value. */
export function valueAt(t: number, min: number, max: number, scale: Scale): number {
  return scale === "log" ? min * Math.pow(max / min, t) : min + (max - min) * t;
}
export function positionOf(v: number, min: number, max: number, scale: Scale): number {
  return scale === "log" ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
}

/** Rounds to 2-3 significant figures so slider values stay readable. */
export function tidy(v: number): number {
  if (v === 0) return 0;
  const digits = Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 10 ? 2 : 3;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - digits + 1);
  const r = Math.round(v / p) * p;
  return Math.abs(r) >= 1 ? Math.round(r * 100) / 100 : r;
}

export function formatNumber(n: number): string {
  if (Math.abs(n) >= 100000) return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(n);
  return new Intl.NumberFormat("en", { maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
}
