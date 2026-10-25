/**
 * Pure logic for the Map game: what to ask, whether a tap is right, and which part of the world to show. No React, no storage.
 * Coordinates are map units: 0 to `w` across (10000), the Miller projection that content/games/map.json uses.
 */

export type Country = { id: string; name: string; continent: string; pop: number; area: number; label: [number, number]; rings: number[][] };
export type River = { name: string; lines: number[][] };
export type Mountain = { name: string; kind: "peak" | "range"; continent: string; at: [number, number] };
export type MapData = { w: number; h: number; countries: Country[]; rivers: River[]; mountains: Mountain[] };

export type Subject = "countries" | "rivers" | "mountains" | "mixed";
export type Region = "World" | "Europe" | "Asia" | "Africa" | "North America" | "South America" | "Oceania";
export type Difficulty = 1 | 2 | 3;
export type MapSettings = { subject: Subject; region: Region; difficulty: Difficulty };

export const REGIONS: Region[] = ["World", "Europe", "Asia", "Africa", "North America", "South America", "Oceania"];
export const SUBJECTS: { id: Subject; label: string }[] = [
  { id: "countries", label: "Countries" },
  { id: "rivers", label: "Rivers" },
  { id: "mountains", label: "Mountains" },
  { id: "mixed", label: "A bit of everything" },
];
export const DIFFICULTY_NAMES: Record<Difficulty, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };
export const DEFAULT_SETTINGS: MapSettings = { subject: "countries", region: "World", difficulty: 1 };

export type Target =
  | { kind: "country"; country: Country }
  | { kind: "river"; river: River }
  | { kind: "mountain"; mountain: Mountain };

export type Rng = () => number;

/** How close a tap has to be (in map units) to count. A country's whole shape counts; tiny ones get a generous circle. */
export const RIVER_REACH = 110;
export const PEAK_REACH = 150;
export const RANGE_REACH = 450;
export const TINY_COUNTRY_AREA = 3000;
export const TINY_COUNTRY_REACH = 170;

export function targetName(t: Target): string {
  return t.kind === "country" ? t.country.name : t.kind === "river" ? t.river.name : t.mountain.name;
}

/** The question shown above the map. */
export function prompt(t: Target): string {
  if (t.kind === "country") return t.country.name;
  if (t.kind === "river") return t.river.name === "Yellow River" || t.river.name === "Orange River" ? t.river.name : "River " + t.river.name;
  return t.mountain.name;
}

export function subjectWord(t: Target): string {
  return t.kind === "country" ? "Find the country" : t.kind === "river" ? "Find the river" : t.mountain.kind === "range" ? "Find the mountain range" : "Find the mountain";
}

// Geometry ----------------------------------------------------------------------------------------------------------------

/** Whether the point is inside any of the shapes (rings given as flat x, y lists). */
export function pointInRings(x: number, y: number, rings: number[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[2 * i]!;
      const yi = ring[2 * i + 1]!;
      const xj = ring[2 * j]!;
      const yj = ring[2 * j + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Shortest distance from a point to any of the lines (flat x, y lists). */
export function distanceToLines(x: number, y: number, lines: number[][]): number {
  let best = Infinity;
  for (const line of lines) {
    for (let i = 0; i + 3 < line.length; i += 2) {
      best = Math.min(best, distToSegment(x, y, line[i]!, line[i + 1]!, line[i + 2]!, line[i + 3]!));
    }
  }
  return best;
}

/** The country under a point, or null for sea. */
export function countryAt(data: MapData, x: number, y: number): Country | null {
  // Small countries first, so a tiny country inside a bigger shape's outline still wins.
  const ordered = [...data.countries].sort((a, b) => a.area - b.area);
  return ordered.find((c) => pointInRings(x, y, c.rings)) ?? null;
}

export type Verdict = { correct: boolean; tapped: string | null };

/** Whether a tap at (x, y) answers the question. `tapped` names what was under the finger when it was a different country. */
export function judge(data: MapData, target: Target, x: number, y: number): Verdict {
  if (target.kind === "country") {
    const hit = countryAt(data, x, y);
    const c = target.country;
    const near = c.area < TINY_COUNTRY_AREA && Math.hypot(x - c.label[0], y - c.label[1]) <= TINY_COUNTRY_REACH;
    const correct = hit?.id === c.id || near;
    return { correct, tapped: correct ? null : (hit?.name ?? null) };
  }
  if (target.kind === "river") {
    const correct = distanceToLines(x, y, target.river.lines) <= RIVER_REACH;
    if (correct) return { correct, tapped: null };
    // Wrong: say which other river was tapped, if one was close enough to mean it.
    const other = data.rivers.filter((r) => r.name !== target.river.name).map((r) => ({ r, d: distanceToLines(x, y, r.lines) })).sort((a, b) => a.d - b.d)[0];
    return { correct, tapped: other && other.d <= RIVER_REACH ? other.r.name : null };
  }
  const reachOf = (m: Mountain) => (m.kind === "range" ? RANGE_REACH : PEAK_REACH);
  const dist = (m: Mountain) => Math.hypot(x - m.at[0], y - m.at[1]);
  const correct = dist(target.mountain) <= reachOf(target.mountain);
  if (correct) return { correct, tapped: null };
  const other = data.mountains.filter((m) => m.name !== target.mountain.name && dist(m) <= reachOf(m)).sort((a, b) => dist(a) - dist(b))[0];
  return { correct, tapped: other?.name ?? null };
}

// Regions -----------------------------------------------------------------------------------------------------------------

const rad = (d: number) => (d * Math.PI) / 180;
const miller = (lat: number) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * rad(lat)));

/** Longitude and latitude in degrees to map units: the same projection the data was built with. */
export function project(lon: number, lat: number, w = 10000): [number, number] {
  const scale = w / (2 * Math.PI);
  const la = Math.max(-56, Math.min(84, lat));
  return [Math.round(((rad(lon) + Math.PI) / (2 * Math.PI)) * w), Math.round((miller(84) - miller(la)) * scale)];
}

/** [west, south, east, north] in degrees. */
const BOXES: Record<Exclude<Region, "World">, [number, number, number, number]> = {
  Europe: [-25, 33, 45, 72],
  Asia: [25, -11, 150, 78],
  Africa: [-20, -36, 53, 38],
  "North America": [-170, 5, -50, 75],
  "South America": [-85, -57, -33, 14],
  Oceania: [110, -48, 180, 2],
};

/** The part of the map to show for a region: x, y, width, height in map units. */
export function regionBox(data: MapData, region: Region): [number, number, number, number] {
  if (region === "World") return [0, 0, data.w, data.h];
  const [w, s, e, n] = BOXES[region];
  const [x0, y0] = project(w, n, data.w);
  const [x1, y1] = project(e, s, data.w);
  const margin = 80;
  return [Math.max(0, x0 - margin), Math.max(0, y0 - margin), Math.min(data.w, x1 + margin) - Math.max(0, x0 - margin), Math.min(data.h, y1 + margin) - Math.max(0, y0 - margin)];
}

function inBox(box: [number, number, number, number], x: number, y: number): boolean {
  return x >= box[0] && x <= box[0] + box[2] && y >= box[1] && y <= box[1] + box[3];
}

// Rounds ------------------------------------------------------------------------------------------------------------------

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Countries in a region, easiest first by size: easy keeps the biggest 40%, medium 75%, hard all of them. */
export function countryPool(data: MapData, region: Region, difficulty: Difficulty): Country[] {
  const inRegion = data.countries.filter((c) => region === "World" || c.continent === region);
  const share = difficulty === 1 ? 0.4 : difficulty === 2 ? 0.75 : 1;
  const bySize = [...inRegion].sort((a, b) => b.area - a.area);
  return bySize.slice(0, Math.max(Math.min(6, bySize.length), Math.ceil(bySize.length * share)));
}

export function riverPool(data: MapData, region: Region): River[] {
  if (region === "World") return data.rivers;
  const box = regionBox(data, region);
  return data.rivers.filter((r) => r.lines.some((line) => { for (let i = 0; i + 1 < line.length; i += 2) if (inBox(box, line[i]!, line[i + 1]!)) return true; return false; }));
}

export function mountainPool(data: MapData, region: Region, difficulty: Difficulty): Mountain[] {
  const inRegion = data.mountains.filter((m) => region === "World" || m.continent === region);
  // Easy asks about ranges and famous peaks only when it has enough of them; ranges are the larger target.
  return difficulty === 1 && inRegion.filter((m) => m.kind === "range").length >= 3 ? inRegion.filter((m) => m.kind === "range") : inRegion;
}

/** A round of up to `length` questions, none repeated. Short when the region has fewer things to ask about. */
export function buildRound(data: MapData, settings: MapSettings, rng: Rng, length: number): Target[] {
  const { subject, region, difficulty } = settings;
  const countries = shuffle(countryPool(data, region, difficulty), rng).map((country): Target => ({ kind: "country", country }));
  const rivers = shuffle(riverPool(data, region), rng).map((river): Target => ({ kind: "river", river }));
  const mountains = shuffle(mountainPool(data, region, difficulty), rng).map((mountain): Target => ({ kind: "mountain", mountain }));
  const pools: Target[][] =
    subject === "countries" ? [countries] : subject === "rivers" ? [rivers] : subject === "mountains" ? [mountains] : [countries, countries, rivers, mountains];
  const picked: Target[] = [];
  // Take from the pools in turn, so a mixed round alternates; stop when every pool is empty.
  let turn = 0;
  while (picked.length < length && pools.some((p) => p.length > 0)) {
    const pool = pools[turn % pools.length]!;
    const next = pool.shift();
    if (next) picked.push(next);
    turn++;
  }
  return picked;
}
