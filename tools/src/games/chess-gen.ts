/**
 * Builds content/games/chess.json: ~150 "mate in one" puzzles for the Chess tactics game.
 *
 *   pnpm --filter tools exec tsx src/games/chess-gen.ts                       (offline fallback: generated positions)
 *   pnpm --filter tools exec tsx src/games/chess-gen.ts path/to/lichess_db_puzzle.csv.zst   (Lichess puzzle database, CC0)
 *
 * Lichess mode: streams the database (zstd or plain csv), keeps mateIn1 puzzles with high popularity, applies
 * Moves[0] (the opponent move) to the FEN, and keeps the position the player sees. Download is NOT committed.
 *   https://database.lichess.org/lichess_db_puzzle.csv.zst
 * Fallback mode: seeded random playouts with chess.js; keeps positions where the side to move has a mating move.
 *
 * Either way `mates` lists the UCI of EVERY legal move that checkmates, computed with chess.js.
 */
import { createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { createZstdDecompress } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

type Puzzle = { id: string; fen: string; sideToMove: "w" | "b"; mates: string[]; rating: number };

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

async function fromLichess(file: string): Promise<Puzzle[]> {
  let input: NodeJS.ReadableStream = createReadStream(file);
  if (file.endsWith(".zst")) input = input.pipe(createZstdDecompress());
  const rl = createInterface({ input });
  const found: (Puzzle & { pop: number })[] = [];
  for await (const line of rl) {
    const f = line.split(",");
    if (f.length < 8 || !(f[7] ?? "").includes("mateIn1")) continue;
    const rating = Number(f[3]);
    const pop = Number(f[5]);
    const plays = Number(f[6]);
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
  console.log(`Lichess: ${found.length} candidates`);
  return spread(found, TARGET).map(({ pop: _pop, ...p }) => p);
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

async function main() {
  const file = process.argv[2];
  const puzzles = file ? await fromLichess(file) : generated();
  const credit = file ? "Puzzles from the Lichess puzzle database (CC0)" : "Positions generated for Detour";
  // Final self-check: every stored mate really is checkmate.
  for (const p of puzzles) {
    for (const m of p.mates) {
      const t = new Chess(p.fen);
      t.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m.slice(4) || undefined });
      if (!t.isCheckmate()) throw new Error(`Bad mate ${m} in ${p.id}`);
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ credit, puzzles }) + "\n");
  console.log(`Wrote ${puzzles.length} puzzles to ${OUT}`);
}

main();
