import { ALGEBRA_LEVELS, ALGEBRA_MAX_LEVEL, generateAlgebra } from "./algebra";
import { ESTIMATION_LEVELS, ESTIMATION_MAX_LEVEL, generateEstimation, isCloseEnough, timesOff, estimationVerdict } from "./estimation";
import { GEOMETRY_LEVELS, GEOMETRY_MAX_LEVEL, generateGeometry } from "./geometry";
import { MENTAL_MATH_LEVELS, MENTAL_MATH_MAX_LEVEL, generateMentalMath, mentalMathLevelFor, type Problem } from "./mentalMath";
import { MONEY_LEVELS, MONEY_MAX_LEVEL, generateMoney } from "./money";
import { NUMBER_THEORY_LEVELS, NUMBER_THEORY_MAX_LEVEL, generateNumberTheory } from "./numberTheory";
import { PROBABILITY_LEVELS, PROBABILITY_MAX_LEVEL, generateProbability } from "./probability";
import { FRACTIONS_LEVELS, FRACTIONS_MAX_LEVEL, generateFractions } from "./fractions";
import { RATES_LEVELS, RATES_MAX_LEVEL, generateRates } from "./rates";
import { makeRng, type Rng } from "./rng";
import { SEQUENCES_LEVELS, SEQUENCES_MAX_LEVEL, generateSequences } from "./sequences";
import { STATISTICS_LEVELS, STATISTICS_MAX_LEVEL, generateStatistics } from "./statistics";

export type TrackId =
  | "mental-math" | "algebra" | "geometry" | "probability" | "number-theory" | "money"
  | "fractions" | "statistics" | "sequences" | "rates" | "estimation";
/** `count` is how many problems the round has; left out, the track's usual number. */
/** `practice` rounds are for trying a level: they do not count toward moving up. */
export type DrillSpec = { track: TrackId; level: number; seed: number; count?: number; practice?: boolean };
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
  fractions: {
    name: "Fractions & ratios",
    blurb: "Fractions, ratios, recipes and map scales",
    levels: FRACTIONS_LEVELS,
    maxLevel: FRACTIONS_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 60_000,
  },
  statistics: {
    name: "Statistics",
    blurb: "Averages, spread, z-scores, risk and polls",
    levels: STATISTICS_LEVELS,
    maxLevel: STATISTICS_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 75_000,
  },
  sequences: {
    name: "Sequences & patterns",
    blurb: "Next terms, nth terms and sums",
    levels: SEQUENCES_LEVELS,
    maxLevel: SEQUENCES_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 60_000,
  },
  rates: {
    name: "Rates & word problems",
    blurb: "Speed, work, mixtures and growth",
    levels: RATES_LEVELS,
    maxLevel: RATES_MAX_LEVEL,
    problems: 3,
    timeLimitMs: 75_000,
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

/** The tracks whose problems are made by level, the same way: a round draws from the player's level and the three below it. */
const LEVELLED: Partial<Record<TrackId, (level: number, r: Rng) => Problem>> = {
  algebra: generateAlgebra,
  geometry: generateGeometry,
  probability: generateProbability,
  "number-theory": generateNumberTheory,
  money: generateMoney,
  fractions: generateFractions,
  statistics: generateStatistics,
  sequences: generateSequences,
  rates: generateRates,
};

/** The problems for one drill round. Deterministic for a given spec. */
export function generateRound(spec: DrillSpec): Problem[] {
  const rng = makeRng(spec.seed);
  const seen = new Set<string>();
  const out: Problem[] = [];
  const wanted = spec.count ?? TRACKS[spec.track].problems;
  for (let guard = 0; out.length < wanted && guard < 50; guard++) {
    // Mental-math rounds mix operations: the first problem is at the player's level, the rest from that level and below.
    // A practice round stays on the level that was picked; a normal round also draws from the three levels below.
    const levelAt = (max: number) => (spec.practice ? Math.min(Math.max(spec.level, 1), max) : mentalMathLevelFor(spec.level, out.length, rng, max));
    const generate = LEVELLED[spec.track];
    const p =
      spec.track === "mental-math"
        ? generateMentalMath(levelAt(MENTAL_MATH_MAX_LEVEL), rng)
        : generate
          ? generate(levelAt(TRACKS[spec.track].maxLevel), rng)
          : generateEstimation(spec.level, rng);
    // Problems with options can share a prompt ("Which is larger?"), so the options are part of what makes them the same.
    const key = p.prompt + (p.choices ? "|" + p.choices.join("|") : "");
    if (seen.has(key)) continue;
    seen.add(key);
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
  // Everything except estimation has one exact answer. Estimation by options does too: the right option.
  if (track !== "estimation" || problem.choices) {
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
