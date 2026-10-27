import { ALGEBRA_LEVELS, ALGEBRA_MAX_LEVEL, generateAlgebra } from "./algebra";
import { ESTIMATION_LEVELS, ESTIMATION_MAX_LEVEL, generateEstimation, isCloseEnough, timesOff, estimationVerdict } from "./estimation";
import { GEOMETRY_LEVELS, GEOMETRY_MAX_LEVEL, generateGeometry } from "./geometry";
import { MENTAL_MATH_LEVELS, MENTAL_MATH_MAX_LEVEL, generateMentalMath, mentalMathLevelFor, type Problem } from "./mentalMath";
import { MONEY_LEVELS, MONEY_MAX_LEVEL, generateMoney } from "./money";
import { NUMBER_THEORY_LEVELS, NUMBER_THEORY_MAX_LEVEL, generateNumberTheory } from "./numberTheory";
import { PROBABILITY_LEVELS, PROBABILITY_MAX_LEVEL, generateProbability } from "./probability";
import { makeRng } from "./rng";

export type TrackId = "mental-math" | "algebra" | "geometry" | "probability" | "number-theory" | "money" | "estimation";
/** `count` is how many problems the round has; left out, the track's usual number. */
export type DrillSpec = { track: TrackId; level: number; seed: number; count?: number };
export type { Problem };

export const TRACKS: Record<TrackId, { name: string; blurb: string; levels: readonly string[]; maxLevel: number; problems: number; timeLimitMs?: number }> = {
  "mental-math": {
    name: "Mental math",
    blurb: "Sums, differences, times, division and shortcuts",
    levels: MENTAL_MATH_LEVELS,
    maxLevel: MENTAL_MATH_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 45_000,
  },
  algebra: {
    name: "Algebra & calculus",
    blurb: "Equations, slopes, derivatives and areas",
    levels: ALGEBRA_LEVELS,
    maxLevel: ALGEBRA_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 60_000,
  },
  geometry: {
    name: "Geometry",
    blurb: "Areas, angles, circles and right triangles",
    levels: GEOMETRY_LEVELS,
    maxLevel: GEOMETRY_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 60_000,
  },
  probability: {
    name: "Probability & counting",
    blurb: "Chances, orders, codes and teams",
    levels: PROBABILITY_LEVELS,
    maxLevel: PROBABILITY_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 60_000,
  },
  "number-theory": {
    name: "Number theory",
    blurb: "Factors, primes, remainders, binary and hex",
    levels: NUMBER_THEORY_LEVELS,
    maxLevel: NUMBER_THEORY_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 60_000,
  },
  money: {
    name: "Everyday money",
    blurb: "Change, discounts, tips and interest",
    levels: MONEY_LEVELS,
    maxLevel: MONEY_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 60_000,
  },
  estimation: {
    name: "Estimation",
    blurb: "Fermi-style guesses",
    levels: ESTIMATION_LEVELS,
    maxLevel: ESTIMATION_MAX_LEVEL,
    problems: 2,
  },
};

export const TRACK_IDS = Object.keys(TRACKS) as TrackId[];

/** The problems for one drill round. Deterministic for a given spec. */
export function generateRound(spec: DrillSpec): Problem[] {
  const rng = makeRng(spec.seed);
  const seen = new Set<string>();
  const out: Problem[] = [];
  const wanted = spec.count ?? TRACKS[spec.track].problems;
  for (let guard = 0; out.length < wanted && guard < 50; guard++) {
    // Mental-math rounds mix operations: the first problem is at the player's level, the rest from that level and below.
    const levelAt = (max: number) => mentalMathLevelFor(spec.level, out.length, rng, max);
    const p =
      spec.track === "mental-math"
        ? generateMentalMath(mentalMathLevelFor(spec.level, out.length, rng), rng)
        : spec.track === "algebra"
          ? generateAlgebra(levelAt(ALGEBRA_MAX_LEVEL), rng)
          : spec.track === "geometry"
            ? generateGeometry(levelAt(GEOMETRY_MAX_LEVEL), rng)
            : spec.track === "probability"
              ? generateProbability(levelAt(PROBABILITY_MAX_LEVEL), rng)
              : spec.track === "number-theory"
                ? generateNumberTheory(levelAt(NUMBER_THEORY_MAX_LEVEL), rng)
                : spec.track === "money"
                  ? generateMoney(levelAt(MONEY_MAX_LEVEL), rng)
                  : generateEstimation(spec.level, rng);
    if (seen.has(p.prompt)) continue;
    seen.add(p.prompt);
    out.push(p);
  }
  return out;
}

// ---------- answers ----------

/** Parses "1,200", "1.5k", "3m", "2e6", "1.2 million". Returns undefined if it is not a number. */
export function parseNumber(input: string): number | undefined {
  const s = input.trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
  const m = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)(k|m|b|thousand|million|billion)?$/.exec(s);
  if (!m) return undefined;
  const mult = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 }[m[2] ?? ""] ?? 1;
  const n = Number(m[1]) * mult;
  return Number.isFinite(n) ? n : undefined;
}

export type Judgement = { correct: boolean; guess?: number; note: string };

export function judge(track: TrackId, problem: Problem, input: string): Judgement {
  const guess = parseNumber(input);
  if (guess === undefined) return { correct: false, note: "That wasn't a number." };
  // Everything except estimation has one exact answer.
  if (track !== "estimation") {
    const ok = Math.abs(guess - problem.answer) < 1e-9;
    return { correct: ok, guess, note: ok ? "Correct" : "Not quite" };
  }
  return { correct: isCloseEnough(guess, problem.answer), guess, note: estimationVerdict(guess, problem.answer) };
}

export { timesOff };

// ---------- levels ----------

export const LEVEL_WINDOW = 20;
export const LEVEL_THRESHOLD = 0.8;

export type SkillProgress = {
  track_id: TrackId;
  level: number;
  /** Results at the current level, newest last, at most LEVEL_WINDOW long. */
  recent_results: boolean[];
  attempts_total: number;
  last_at: number;
};

export const emptyProgress = (track_id: TrackId): SkillProgress => ({ track_id, level: 1, recent_results: [], attempts_total: 0, last_at: 0 });

/** Level up at 80% over the last 20 attempts at this level. */
export function shouldLevelUp(recent: boolean[]): boolean {
  if (recent.length < LEVEL_WINDOW) return false;
  const last = recent.slice(-LEVEL_WINDOW);
  return last.filter(Boolean).length / LEVEL_WINDOW >= LEVEL_THRESHOLD;
}

export function applyResults(progress: SkillProgress, results: boolean[], now: number): { progress: SkillProgress; leveledUp: boolean } {
  const max = TRACKS[progress.track_id].maxLevel;
  let recent = [...progress.recent_results, ...results].slice(-LEVEL_WINDOW);
  let level = progress.level;
  let leveledUp = false;
  if (level < max && shouldLevelUp(recent)) {
    level += 1;
    recent = []; // fresh start on the new level
    leveledUp = true;
  }
  return { progress: { ...progress, level, recent_results: recent, attempts_total: progress.attempts_total + results.length, last_at: now }, leveledUp };
}

/** Picks the track practised least recently (never-practised tracks first). */
export function nextTrack(all: SkillProgress[], allowed: readonly TrackId[] = TRACK_IDS): TrackId {
  const byId = new Map(all.map((p) => [p.track_id, p]));
  return [...allowed].sort((a, b) => (byId.get(a)?.last_at ?? 0) - (byId.get(b)?.last_at ?? 0))[0]!;
}
