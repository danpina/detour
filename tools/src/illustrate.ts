// `pnpm tools illustrate --id <draft-id> --scene doors|fold|numberline|growth|chunks`
// Draws a simple flat illustration in the house style (see tools/style.md) for abstract ideas where no open-licensed
// photo fits, and adds it to the draft's image candidates as a "generated" illustration (credit "Illustration").
// No text, no real people, no photorealism, so it can never pass as evidence.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Candidate, CandidatesFile } from "./images.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const W = 1080;
const H = 1350;
const CREAM = "#f4ead5";
const TEAL = "#0f766e";
const DEEP = "#0b3b4a";
const ORANGE = "#d9731f";
const CHAR = "#1f2933";
const SAND = "#e3d3b0";

const wrap = (inner: string, bg = CREAM) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${inner}</svg>`;

type Scene = { alt: string; svg: () => string };

const scenes: Record<string, Scene> = {
  doors: {
    alt: "Illustration of three identical closed doors side by side on a cream wall",
    svg: () => {
      const door = (x: number, color: string) =>
        `<g><rect x="${x}" y="470" width="260" height="520" rx="130" fill="${color}"/><rect x="${x + 30}" y="500" width="200" height="490" rx="100" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="6"/><circle cx="${x + 205}" cy="760" r="15" fill="${SAND}"/></g>`;
      return wrap(
        `<rect y="990" width="${W}" height="360" fill="${SAND}"/>
         <circle cx="880" cy="230" r="90" fill="${ORANGE}" opacity="0.9"/>
         ${door(110, TEAL)}${door(410, DEEP)}${door(710, ORANGE)}
         <rect x="70" y="985" width="940" height="22" rx="8" fill="${CHAR}" opacity="0.8"/>`,
      );
    },
  },
  fold: {
    alt: "Illustration of a stack of paper that doubles in height with each layer, rising toward a small moon",
    svg: () => {
      // The stack stays in the lower-middle band; the Moon sits clear in the upper right.
      let layers = "";
      let y = 1010;
      let h = 6;
      for (let i = 0; i < 9; i++) {
        layers += `<rect x="${300 + i * 4}" y="${y - h}" width="${480 - i * 8}" height="${h}" rx="3" fill="${i % 2 ? TEAL : DEEP}"/>`;
        y -= h;
        h = Math.min(h * 1.7, 62);
      }
      return wrap(
        `<circle cx="850" cy="300" r="95" fill="${SAND}"/><circle cx="820" cy="275" r="20" fill="#d6c59d"/><circle cx="880" cy="330" r="28" fill="#d6c59d"/>
         <path d="M 560 ${y - 20} C 600 ${y - 160}, 760 ${y - 330}, 840 430" fill="none" stroke="${ORANGE}" stroke-width="8" stroke-dasharray="4 20" stroke-linecap="round"/>
         ${layers}<rect x="250" y="1010" width="580" height="22" rx="10" fill="${CHAR}"/>`,
      );
    },
  },
  numberline: {
    alt: "Illustration of a number line with dots closing in on a large final point",
    svg: () => {
      let marks = "";
      const x0 = 140;
      const x1 = 940;
      const y = 700;
      const xs = [0, 0.5, 0.75, 0.875, 0.9375, 0.96875, 0.984375, 0.9921875];
      xs.forEach((t, i) => {
        marks += `<circle cx="${x0 + (x1 - x0) * t}" cy="${y}" r="${12 + i * 1.5}" fill="${i % 2 ? TEAL : DEEP}"/>`;
      });
      return wrap(
        `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${CHAR}" stroke-width="10" stroke-linecap="round"/>
         ${[0, 0.25, 0.5, 0.75, 1].map((t) => `<line x1="${x0 + (x1 - x0) * t}" y1="${y - 30}" x2="${x0 + (x1 - x0) * t}" y2="${y + 30}" stroke="${CHAR}" stroke-width="8" stroke-linecap="round"/>`).join("")}
         ${marks}
         <circle cx="${x1}" cy="${y}" r="46" fill="none" stroke="${ORANGE}" stroke-width="12"/><circle cx="${x1}" cy="${y}" r="22" fill="${ORANGE}"/>
         <path d="M ${x0 + 30} 560 C 400 430, 700 430, ${x1 - 20} 600" fill="none" stroke="${ORANGE}" stroke-width="8" stroke-dasharray="2 24" stroke-linecap="round"/>`,
      );
    },
  },
  growth: {
    alt: "Illustration of an exponential curve rising from flat to steep, with coins stacked along it",
    svg: () => {
      let path = "M 140 1100";
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const x = 140 + 800 * t;
        const y = 1100 - 820 * ((Math.exp(4.2 * t) - 1) / (Math.exp(4.2) - 1));
        pts.push([x, y]);
        path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      const coins = [0.2, 0.45, 0.65, 0.8, 0.92, 1].map((t, i) => {
        const [x, y] = pts[Math.round(t * 60)]!;
        const r = 18 + i * 7;
        return `<circle cx="${x.toFixed(1)}" cy="${(y - r).toFixed(1)}" r="${r}" fill="${ORANGE}"/><circle cx="${x.toFixed(1)}" cy="${(y - r).toFixed(1)}" r="${(r * 0.62).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="4"/>`;
      });
      // Drawn at about half size in the middle band so the top and bottom thirds stay free for text.
      return wrap(
        `<g transform="translate(229 330) scale(0.55)"><line x1="140" y1="1100" x2="960" y2="1100" stroke="${CHAR}" stroke-width="12" stroke-linecap="round"/><line x1="140" y1="1100" x2="140" y2="240" stroke="${CHAR}" stroke-width="12" stroke-linecap="round"/>
         <path d="${path} L 940 1100 Z" fill="${TEAL}" opacity="0.14"/><path d="${path}" fill="none" stroke="${TEAL}" stroke-width="20" stroke-linejoin="round" stroke-linecap="round"/>
         ${coins.join("")}</g>`,
      );
    },
  },
  fourcolor: {
    alt: "Illustration of an abstract map made of irregular regions in exactly four colours, with no two neighbouring regions sharing a colour",
    svg: () => {
      // A 3x3 patchwork on a jittered grid. Colour = (row parity, column parity), so neighbours always differ.
      const jitter = [
        [[0, 0], [14, -10], [-12, 8], [0, 0]],
        [[-10, 12], [18, 16], [-16, -12], [10, 6]],
        [[8, -14], [-14, 10], [12, -8], [-6, 12]],
        [[0, 0], [-8, 12], [10, -6], [0, 0]],
      ];
      const x0 = 150;
      const y0 = 420;
      const step = 260;
      const pt = (r: number, c: number): [number, number] => [x0 + c * step + jitter[r]![c]![0]!, y0 + r * 190 + jitter[r]![c]![1]!];
      const colors = [TEAL, ORANGE, DEEP, "#c9a227"];
      let cells = "";
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const pts = [pt(r, c), pt(r, c + 1), pt(r + 1, c + 1), pt(r + 1, c)].map((p) => p.join(",")).join(" ");
          cells += `<polygon points="${pts}" fill="${colors[(r % 2) * 2 + (c % 2)]}" stroke="${CREAM}" stroke-width="8" stroke-linejoin="round"/>`;
        }
      }
      return wrap(cells);
    },
  },
  sudoku: {
    alt: "Illustration of a nine-by-nine Sudoku grid with a few coloured dots marking the given clues",
    svg: () => {
      const size = 720;
      const x0 = (W - size) / 2;
      const y0 = 340;
      const cell = size / 9;
      const given: [number, number, string][] = [
        [0, 2, TEAL], [0, 6, ORANGE], [1, 0, DEEP], [1, 4, TEAL], [2, 7, ORANGE], [3, 1, TEAL], [3, 5, DEEP], [4, 3, ORANGE], [4, 8, TEAL],
        [5, 2, DEEP], [5, 6, TEAL], [6, 0, ORANGE], [6, 4, DEEP], [7, 3, TEAL], [7, 8, ORANGE], [8, 1, DEEP], [8, 5, TEAL],
      ];
      let lines = "";
      for (let i = 0; i <= 9; i++) {
        const thick = i % 3 === 0;
        const w = thick ? 8 : 3;
        lines += `<line x1="${x0}" y1="${y0 + i * cell}" x2="${x0 + size}" y2="${y0 + i * cell}" stroke="${CHAR}" stroke-width="${w}" stroke-linecap="round"/>`;
        lines += `<line x1="${x0 + i * cell}" y1="${y0}" x2="${x0 + i * cell}" y2="${y0 + size}" stroke="${CHAR}" stroke-width="${w}" stroke-linecap="round"/>`;
      }
      const dots = given.map(([r, c, col]) => `<circle cx="${x0 + c * cell + cell / 2}" cy="${y0 + r * cell + cell / 2}" r="22" fill="${col}"/>`).join("");
      return wrap(`<rect x="${x0}" y="${y0}" width="${size}" height="${size}" rx="10" fill="#fbf5e6"/>${lines}${dots}`);
    },
  },
  chunks: {
    alt: "Illustration of four small groups of dots held inside a rounded outline, suggesting items held in mind",
    svg: () => {
      const group = (cx: number, cy: number, color: string) =>
        [[-30, -26], [30, -26], [-30, 26], [30, 26]].map(([dx, dy]) => `<circle cx="${cx + dx!}" cy="${cy + dy!}" r="20" fill="${color}"/>`).join("") +
        `<rect x="${cx - 70}" y="${cy - 66}" width="140" height="132" rx="40" fill="none" stroke="${color}" stroke-width="6" opacity="0.6"/>`;
      return wrap(
        `<circle cx="540" cy="640" r="400" fill="${SAND}"/><circle cx="540" cy="640" r="400" fill="none" stroke="${CHAR}" stroke-width="8" opacity="0.5"/>
         ${group(400, 540, TEAL)}${group(680, 540, ORANGE)}${group(400, 760, DEEP)}${group(680, 760, TEAL)}`,
      );
    },
  },
};

export async function runIllustrate(argv: string[]): Promise<number> {
  const val = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const id = val("id");
  const name = val("scene");
  if (!id || !name || !scenes[name]) {
    console.error(`Usage: pnpm tools illustrate --id <draft-id> --scene ${Object.keys(scenes).join("|")}`);
    return 1;
  }
  const dir = path.join(ROOT, "content/drafts", `${id}.images`);
  await mkdir(dir, { recursive: true });
  const scene = scenes[name]!;
  const file = `gen-${name}.png`;
  await sharp(Buffer.from(scene.svg())).resize(W, H).png({ compressionLevel: 9 }).toFile(path.join(dir, file));

  const candFile = path.join(dir, "candidates.json");
  const cands: CandidatesFile = existsSync(candFile)
    ? JSON.parse((await readFile(candFile, "utf8")).replace(/^﻿/, ""))
    : { draft_id: id, created_at: new Date().toISOString(), queries: [], candidates: [], rejected: [], needs_generation: false, notes: [] };
  const cand: Candidate = {
    id: `generated-${name}`,
    source: "generated",
    kind: "generated",
    title: `Illustration: ${name}`,
    credit: "Illustration",
    license: "Generated",
    file,
    alt_suggestion: scene.alt,
  };
  cands.candidates = [...cands.candidates.filter((c) => c.id !== cand.id), cand];
  cands.needs_generation = false;
  await writeFile(candFile, JSON.stringify(cands, null, 2) + "\n");
  console.log(`${id}: added illustration "${name}" (${file})`);
  return 0;
}
