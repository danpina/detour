/**
 * Builds content/games/chess.json: ~150 "mate in one" puzzles for the Chess tactics game.
 *
 *   pnpm --filter tools exec tsx src/games/chess-gen.ts                       (offline fallback: generated positions)
 *   pnpm --filter tools exec tsx src/games/chess-gen.ts path/to/lichess_db_puzzle.csv.zst   (Lichess puzzle database, CC0)
 *
 * Lichess mode: streams the database (zstd or plain csv) once. Easy set: mateIn1 puzzles with high popularity. Hard set: mateIn2 and
 * mateIn3 puzzles with a line of moves to play. In both, Moves[0] (the opponent move) is applied to the FEN, and the position the player
 * sees is kept. Download is NOT committed.
 *   https://database.lichess.org/lichess_db_puzzle.csv.zst
 * Fallback mode: seeded random playouts with chess.js; keeps positions where the side to move has a mating move.
 *
 * Either way `mates` lists the UCI of EVERY legal move that checkmates, computed with chess.js.
 */
import { closeSync, createReadStream, existsSync, mkdirSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { createZstdDecompress } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

type Puzzle = {
  id: string;
  fen: string;
  sideToMove: "w" | "b";
  /** UCI of every legal move that checkmates (for a line: at the last move). */
  mates: string[];
  rating: number;
  /** Mate in two or three: the player's move, the opponent's reply, the player's next move, ... The last one mates (any move in `mates` does). */
  line?: string[];
};

const TARGET = 150;
const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../../../content/games/chess.json");

function uci(m: { from: string; to: string; promotion?: string }): string {
  return m.from + m.to + (m.promotion ?? "");
}

function matesFor(fen: string): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    if (c.isCheckmate()) out.push(uci(m));
    c.undo();
  }
  return out;
}

function toPuzzle(id: string, fen: string, rating: number): Puzzle | null {
  let mates: string[];
  try {
    mates = matesFor(fen);
  } catch {
    return null;
  }
  if (mates.length === 0) return null;
  return { id, fen, sideToMove: fen.split(" ")[1] === "b" ? "b" : "w", mates, rating };
}

/** Spread picks evenly over the rating range so the ramp has easy and hard ones. */
function spread<T extends { rating: number }>(all: T[], n: number): T[] {
  const sorted = [...all].sort((a, b) => a.rating - b.rating);
  if (sorted.length <= n) return sorted;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(sorted[Math.floor((i * sorted.length) / n)]!);
  return out;
}

type HardRow = { id: string; fen: string; moves: string[]; rating: number; pop: number };

/** A mate-in-two or -three from the database as a line to play. Returns null unless every move is legal and the last one mates. */
function toHard(row: HardRow): Puzzle | null {
  try {
    const c = new Chess(row.fen);
    const play = (u: string) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.slice(4) || undefined });
    play(row.moves[0]!);
    const start = c.fen();
    const line = row.moves.slice(1);
    // The player moves first and last: 3 moves for a mate in two, 5 for a mate in three.
    if (line.length < 3 || line.length % 2 === 0) return null;
    for (const u of line.slice(0, -1)) play(u);
    const mates = matesFor(c.fen());
    if (!mates.includes(line[line.length - 1]!)) return null;
    return { id: row.id, fen: start, sideToMove: start.split(" ")[1] === "b" ? "b" : "w", mates, rating: row.rating, line };
  } catch {
    return null;
  }
}

/** Per 100 rating points between 1000 and 2400, the most popular puzzles: a smooth climb from hard to very hard. */
function pickHard(rows: HardRow[], perBucket: number): Puzzle[] {
  const out: Puzzle[] = [];
  for (let bucket = 10; bucket < 24; bucket++) {
    const inBucket = rows.filter((r) => Math.floor(r.rating / 100) === bucket).sort((a, b) => b.pop - a.pop || a.id.localeCompare(b.id));
    let taken = 0;
    for (const row of inBucket) {
      if (taken >= perBucket) break;
      const p = toHard(row);
      if (p) {
        out.push(p);
        taken++;
      }
    }
  }
  return out.sort((a, b) => a.rating - b.rating).map((p, i) => ({ ...p, id: "h" + String(i + 1).padStart(3, "0") }));
}

/** Where the compressed data starts. Lichess files begin with a small "skippable" frame that Node's decoder does not accept, so skip it. */
function zstdStart(file: string): number {
  const fd = openSync(file, "r");
  try {
    const head = Buffer.alloc(8);
    readSync(fd, head, 0, 8, 0);
    const magic = head.readUInt32LE(0);
    return (magic & 0xfffffff0) === 0x184d2a50 ? 8 + head.readUInt32LE(4) : 0;
  } finally {
    closeSync(fd);
  }
}

async function fromLichess(file: string): Promise<{ easy: Puzzle[]; hard: Puzzle[] }> {
  let input: NodeJS.ReadableStream = createReadStream(file, file.endsWith(".zst") ? { start: zstdStart(file) } : undefined);
  if (file.endsWith(".zst")) input = input.pipe(createZstdDecompress());
  const rl = createInterface({ input });
  const found: (Puzzle & { pop: number })[] = [];
  const hardRows: HardRow[] = [];
  for await (const line of rl) {
    const f = line.split(",");
    if (f.length < 8) continue;
    const themes = f[7] ?? "";
    const rating = Number(f[3]);
    const pop = Number(f[5]);
    const plays = Number(f[6]);
    if ((themes.includes("mateIn2") || themes.includes("mateIn3")) && rating >= 1000 && rating < 2400 && pop >= 90 && plays >= 1000) {
      hardRows.push({ id: f[0] ?? "", fen: f[1] ?? "", moves: (f[2] ?? "").split(" "), rating, pop });
      continue;
    }
    if (!themes.includes("mateIn1")) continue;
    if (!(rating >= 500 && rating <= 1500) || pop < 90 || plays < 500) continue;
    try {
      const c = new Chess(f[1]);
      const first = (f[2] ?? "").split(" ")[0] ?? "";
      c.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first.slice(4) || undefined });
      const p = toPuzzle(f[0] ?? "", c.fen(), rating);
      if (p) found.push({ ...p, pop });
    } catch {
      // skip malformed row
    }
  }
  console.log(`Lichess: ${found.length} easy and ${hardRows.length} hard candidates`);
  return { easy: spread(found, TARGET).map(({ pop: _pop, ...p }) => p), hard: pickHard(hardRows, 55) };
}

// Small seeded PRNG (mulberry32) so the fallback output is reproducible.
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rough difficulty in 500..1500: more pieces, more legal moves, quiet or few mating moves = harder. */
function estimateRating(fen: string, mates: string[]): number {
  const c = new Chess(fen);
  const pieces = (fen.split(" ")[0] ?? "").replace(/[^a-zA-Z]/g, "").length;
  const legal = c.moves().length;
  const quiet = c.moves({ verbose: true }).some((m) => mates.includes(uci(m)) && !m.captured) ? 1 : 0;
  const raw = pieces * 20 + legal * 8 + (mates.length === 1 ? 120 : 0) + quiet * 40;
  return Math.max(500, Math.min(1500, Math.round((raw - 100) / 10) * 10));
}

function generated(): Puzzle[] {
  const rand = rng(20261021);
  const seen = new Set<string>();
  const found: Puzzle[] = [];
  let games = 0;
  while (found.length < 220 && games < 20000) {
    games++;
    const c = new Chess();
    for (let ply = 0; ply < 160 && !c.isGameOver(); ply++) {
      const moves = c.moves({ verbose: true });
      // Mild bias to captures and checks so games reach thin endgames with real mating chances.
      const weighted = moves.filter((m) => m.san.includes("x") || m.san.includes("+"));
      const pool = weighted.length > 0 && rand() < 0.45 ? weighted : moves;
      c.move(pool[Math.floor(rand() * pool.length)]!);
      if (ply < 24) continue;
      const fen = c.fen();
      const key = fen.split(" ").slice(0, 2).join(" ");
      if (seen.has(key) || c.isGameOver()) continue;
      const mates = matesFor(fen);
      if (mates.length === 0 || mates.length > 3) continue;
      const pieces = (fen.split(" ")[0] ?? "").replace(/[^a-zA-Z]/g, "").length;
      if (pieces < 5) continue;
      seen.add(key);
      found.push({ id: "g" + String(found.length + 1).padStart(4, "0"), fen, sideToMove: fen.split(" ")[1] === "b" ? "b" : "w", mates, rating: estimateRating(fen, mates) });
      break;
    }
  }
  console.log(`Generated: ${found.length} candidates from ${games} playouts`);
  const picked = spread(found, TARGET);
  return picked.map((p, i) => ({ ...p, id: "g" + String(i + 1).padStart(3, "0") }));
}

/**
 * Harder "mate in one": busy boards, few mating moves, and a quiet mating move (no capture) that is easy to overlook.
 * Same positions every run (own seed). The easy set above is untouched.
 */
function hardRating(fen: string, mates: string[]): number {
  const c = new Chess(fen);
  const pieces = (fen.split(" ")[0] ?? "").replace(/[^a-zA-Z]/g, "").length;
  const legal = c.moves().length;
  const mover = c.moves({ verbose: true }).find((m) => mates.includes(uci(m)))!;
  const oddPiece = mover.piece === "n" || mover.piece === "p" || mover.promotion ? 1 : 0;
  const raw = 1000 + pieces * 14 + legal * 4 + (mates.length === 1 ? 140 : 0) + oddPiece * 90 + (mover.flags.includes("k") || mover.flags.includes("q") ? 120 : 0);
  return Math.max(1000, Math.min(1900, Math.round(raw / 10) * 10));
}

function generatedHard(): Puzzle[] {
  const rand = rng(20261025);
  const seen = new Set<string>();
  const found: Puzzle[] = [];
  let games = 0;
  const started = Date.now();
  while (found.length < 260 && games < 60000 && Date.now() - started < 8 * 60 * 1000) {
    games++;
    if (games % 500 === 0) console.log(`  hard: ${games} playouts, ${found.length} found`);
    const c = new Chess();
    for (let ply = 0; ply < 70 && !c.isGameOver(); ply++) {
      const moves = c.moves({ verbose: true });
      // Prefer quiet developing play so the board stays full of pieces.
      const quiet = moves.filter((m) => !m.captured);
      const pool = quiet.length > 0 && rand() < 0.8 ? quiet : moves;
      c.move(pool[Math.floor(rand() * pool.length)]!);
      // Look at every second position only, and only boards that are still busy: it keeps the search fast.
      if (ply < 14 || ply % 2 === 1) continue;
      const fen = c.fen();
      const pieces = (fen.split(" ")[0] ?? "").replace(/[^a-zA-Z]/g, "").length;
      if (pieces < 12) break;
      const key = fen.split(" ").slice(0, 2).join(" ");
      if (seen.has(key) || c.isGameOver()) continue;
      if (c.moves().length < 20) continue;
      const mates = matesFor(fen);
      if (mates.length === 0 || mates.length > 2) continue;
      // The mating move must be quiet: not a capture, so it is not the first thing the eye goes to.
      const mating = c.moves({ verbose: true }).filter((m) => mates.includes(uci(m)));
      if (mating.some((m) => m.captured)) continue;
      seen.add(key);
      found.push({ id: "h" + String(found.length + 1).padStart(4, "0"), fen, sideToMove: fen.split(" ")[1] === "b" ? "b" : "w", mates, rating: hardRating(fen, mates) });
      break;
    }
  }
  console.log(`Hard: ${found.length} candidates from ${games} playouts`);
  return spread(found, 120).map((p, i) => ({ ...p, id: "h" + String(i + 1).padStart(3, "0") }));
}

async function main() {
  const file = process.argv[2];
  // Without a Lichess file the easy set is kept as it is (it is already in chess.json), so only the hard set is searched for.
  const existing = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as { puzzles?: Puzzle[] }).puzzles : undefined;
  const lichess = file ? await fromLichess(file) : null;
  const puzzles = lichess ? lichess.easy : existing && existing.length > 0 ? existing : generated();
  const hard = lichess ? lichess.hard : generatedHard();
  const credit = file ? "Puzzles from the Lichess puzzle database (CC0)" : "Positions generated for Detour";
  // Final self-check: every stored mate really is checkmate, after the line (if any) has been played.
  for (const p of [...puzzles, ...hard]) {
    const base = new Chess(p.fen);
    for (const u of (p.line ?? []).slice(0, -1)) base.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.slice(4) || undefined });
    for (const m of p.mates) {
      const t = new Chess(base.fen());
      t.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m.slice(4) || undefined });
      if (!t.isCheckmate()) throw new Error(`Bad mate ${m} in ${p.id}`);
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ credit, puzzles, hard }) + "\n");
  console.log(`Wrote ${puzzles.length} easy and ${hard.length} hard puzzles to ${OUT}`);
}

main();
