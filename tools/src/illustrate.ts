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
  colorwords: {
    alt: "Illustration of four big colour discs, each with a small disc of a clashing colour inside it",
    svg: () => {
      const pairs: [string, string][] = [
        [ORANGE, TEAL],
        [TEAL, "#e9c46a"],
        ["#b8434b", "#2a9d8f"],
        ["#e9c46a", "#b8434b"],
      ];
      let out = "";
      pairs.forEach(([outer, inner], i) => {
        const cx = 330 + (i % 2) * 420;
        const cy = 500 + Math.floor(i / 2) * 400;
        out += `<circle cx="${cx}" cy="${cy}" r="170" fill="${outer}"/><circle cx="${cx}" cy="${cy}" r="72" fill="${inner}"/>`;
      });
      return wrap(out, DEEP);
    },
  },
  mirrorstar: {
    alt: "Illustration of a pencil tracing a star shape between two close outlines, seen as if in a mirror",
    svg: () => {
      const star = (cx: number, cy: number, ro: number, ri: number) =>
        Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI / 5) * i - Math.PI / 2;
          const r = i % 2 ? ri : ro;
          return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
        }).join(" ");
      return wrap(
        `<rect x="180" y="300" width="720" height="760" rx="40" fill="${SAND}" stroke="${CHAR}" stroke-width="10"/>
         <polygon points="${star(540, 690, 270, 112)}" fill="none" stroke="${CHAR}" stroke-width="5"/>
         <polygon points="${star(540, 690, 215, 90)}" fill="none" stroke="${CHAR}" stroke-width="5"/>
         <path d="M 540 420 L 596 601 L 790 600 L 633 712" fill="none" stroke="${ORANGE}" stroke-width="12" stroke-linecap="round"/>
         <g transform="translate(640 560) rotate(40)"><rect x="-18" y="-180" width="36" height="170" fill="${TEAL}"/><polygon points="-18,-10 18,-10 0,40" fill="${CHAR}"/><rect x="-18" y="-205" width="36" height="25" fill="${ORANGE}"/></g>`,
      );
    },
  },
  missing: {
    alt: "Illustration of a row of street lamps along a road, with one lamp missing and only a dotted outline left",
    svg: () => {
      let out = `<rect y="900" width="${W}" height="450" fill="${SAND}"/><rect y="890" width="${W}" height="20" fill="${CHAR}" opacity="0.7"/><circle cx="820" cy="280" r="80" fill="${ORANGE}" opacity="0.9"/>`;
      for (let i = 0; i < 5; i++) {
        const x = 130 + i * 205;
        if (i === 2) {
          out += `<g fill="none" stroke="${CHAR}" stroke-width="6" stroke-dasharray="10 14" stroke-linecap="round"><line x1="${x}" y1="900" x2="${x}" y2="470"/><path d="M ${x} 470 q 0 -40 55 -40"/><circle cx="${x + 62}" cy="440" r="26"/></g>`;
        } else {
          out += `<line x1="${x}" y1="900" x2="${x}" y2="470" stroke="${DEEP}" stroke-width="16" stroke-linecap="round"/><path d="M ${x} 470 q 0 -40 55 -40" fill="none" stroke="${DEEP}" stroke-width="16" stroke-linecap="round"/><circle cx="${x + 62}" cy="440" r="26" fill="${i % 2 ? TEAL : ORANGE}"/>`;
        }
      }
      return wrap(out);
    },
  },
  wordcards: {
    alt: "Illustration of a column of seven word cards where the first and last are bright and the middle ones fade away",
    svg: () => {
      const op = [1, 0.55, 0.3, 0.2, 0.3, 0.55, 1];
      let out = "";
      op.forEach((o, i) => {
        const y = 300 + i * 108;
        out += `<rect x="260" y="${y}" width="560" height="88" rx="26" fill="${i === 0 || i === 6 ? ORANGE : TEAL}" opacity="${o}"/>`;
        for (let d = 0; d < 3; d++) out += `<rect x="${310 + d * 70}" y="${y + 30}" width="46" height="28" rx="12" fill="${CREAM}" opacity="${Math.max(o, 0.5)}"/>`;
      });
      return wrap(out);
    },
  },
  rocketpath: {
    alt: "Illustration of a rocket veering away from its dotted straight path into a night sky",
    svg: () => {
      let stars = "";
      for (let i = 0; i < 22; i++) stars += `<circle cx="${((i * 197) % 1000) + 40}" cy="${((i * 311) % 800) + 220}" r="${i % 3 ? 3 : 5}" fill="${CREAM}" opacity="0.7"/>`;
      return wrap(
        `${stars}<line x1="420" y1="1000" x2="420" y2="330" stroke="${CREAM}" stroke-width="8" stroke-dasharray="4 22" stroke-linecap="round" opacity="0.8"/>
         <path d="M 420 1000 C 420 800, 470 700, 600 600" fill="none" stroke="${ORANGE}" stroke-width="10" stroke-linecap="round" opacity="0.8"/>
         <g transform="translate(640 560) rotate(55)"><path d="M 0 -120 C 40 -60 40 40 28 80 L -28 80 C -40 40 -40 -60 0 -120 Z" fill="${CREAM}"/><circle cx="0" cy="-30" r="16" fill="${TEAL}"/><polygon points="-28,50 -64,100 -28,84" fill="${ORANGE}"/><polygon points="28,50 64,100 28,84" fill="${ORANGE}"/><path d="M -18 84 L 0 160 L 18 84 Z" fill="${ORANGE}"/></g>`,
        DEEP,
      );
    },
  },
  chipgrid: {
    alt: "Illustration of a computer chip above a lookup-table grid with one highlighted cell",
    svg: () => {
      let pins = "";
      for (let i = 0; i < 6; i++) {
        const o = 360 + i * 50;
        pins += `<rect x="${o}" y="300" width="22" height="50" fill="${CHAR}"/><rect x="${o}" y="630" width="22" height="50" fill="${CHAR}"/>`;
      }
      let grid = "";
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 6; c++) {
          const hot = r === 3 && c === 2;
          grid += `<rect x="${330 + c * 70}" y="${740 + r * 56}" width="64" height="50" rx="8" fill="${hot ? ORANGE : TEAL}" opacity="${hot ? 1 : 0.55}"/>`;
        }
      return wrap(`${pins}<rect x="350" y="340" width="300" height="300" rx="30" fill="${DEEP}"/><rect x="400" y="390" width="200" height="200" rx="16" fill="none" stroke="${CREAM}" stroke-width="6" opacity="0.6"/>${grid}`);
    },
  },
  wormtrail: {
    alt: "Illustration of four linked computer screens with a small wiggly worm trail copying itself from one to the next",
    svg: () => {
      const screen = (x: number, y: number, hot: boolean) =>
        `<rect x="${x}" y="${y}" width="250" height="180" rx="22" fill="${DEEP}"/><rect x="${x + 18}" y="${y + 18}" width="214" height="124" rx="10" fill="${hot ? ORANGE : TEAL}" opacity="0.85"/><rect x="${x + 85}" y="${y + 180}" width="80" height="26" fill="${CHAR}"/><rect x="${x + 55}" y="${y + 206}" width="140" height="14" rx="7" fill="${CHAR}"/>`;
      const worm = (x: number, y: number) => `<path d="M ${x} ${y} q 20 -30 40 0 t 40 0 t 40 0" fill="none" stroke="${CREAM}" stroke-width="14" stroke-linecap="round"/>`;
      return wrap(
        `<g stroke="${CHAR}" stroke-width="6" stroke-dasharray="6 14" stroke-linecap="round" fill="none"><path d="M 400 480 L 680 480"/><path d="M 275 600 L 275 830"/><path d="M 805 600 L 805 830"/><path d="M 400 920 L 680 920"/></g>
         ${screen(150, 390, true)}${screen(680, 390, true)}${screen(150, 830, false)}${screen(680, 830, false)}
         ${worm(185, 480)}${worm(715, 480)}`,
      );
    },
  },
  goqr: {
    alt: "Illustration of a Go board with black and white stones forming the three square corner markers of a QR code",
    svg: () => {
      const n = 11;
      const size = 760;
      const x0 = (W - size) / 2;
      const y0 = 300;
      const step = size / (n - 1);
      let out = `<rect x="${x0 - 50}" y="${y0 - 50}" width="${size + 100}" height="${size + 100}" rx="24" fill="#e0b46a"/>`;
      for (let i = 0; i < n; i++) {
        out += `<line x1="${x0}" y1="${y0 + i * step}" x2="${x0 + size}" y2="${y0 + i * step}" stroke="${CHAR}" stroke-width="3"/><line x1="${x0 + i * step}" y1="${y0}" x2="${x0 + i * step}" y2="${y0 + size}" stroke="${CHAR}" stroke-width="3"/>`;
      }
      const stone = (r: number, c: number, black: boolean) => `<circle cx="${x0 + c * step}" cy="${y0 + r * step}" r="${step * 0.42}" fill="${black ? CHAR : "#fbf5e6"}" stroke="${CHAR}" stroke-width="2"/>`;
      const finder = (r0: number, c0: number) => {
        let s = "";
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 4; c++) {
            const edge = r === 0 || c === 0 || r === 3 || c === 3;
            s += stone(r0 + r, c0 + c, edge);
          }
        return s;
      };
      out += finder(0, 0) + finder(0, 7) + finder(7, 0) + stone(6, 6, true) + stone(8, 8, false) + stone(5, 5, false) + stone(10, 10, true);
      return wrap(out);
    },
  },
  banknote: {
    alt: "Illustration of an old paper banknote with a round seal and handwritten-style lines, next to a small stack of coins",
    svg: () =>
      wrap(
        `<g transform="rotate(-6 540 640)"><rect x="170" y="430" width="740" height="420" rx="26" fill="#f9f1dc" stroke="${CHAR}" stroke-width="8"/><rect x="205" y="465" width="670" height="350" rx="14" fill="none" stroke="${TEAL}" stroke-width="4" stroke-dasharray="3 10"/>
         <circle cx="720" cy="640" r="95" fill="${ORANGE}" opacity="0.85"/><circle cx="720" cy="640" r="68" fill="none" stroke="${CREAM}" stroke-width="5"/>
         <path d="M 250 560 q 40 -40 80 0 t 80 0 t 80 0" fill="none" stroke="${DEEP}" stroke-width="7" stroke-linecap="round"/><path d="M 250 650 L 560 650 M 250 700 L 520 700 M 250 750 L 430 750" stroke="${DEEP}" stroke-width="8" stroke-linecap="round" opacity="0.6"/></g>
         <ellipse cx="300" cy="990" rx="90" ry="22" fill="${SAND}" stroke="${CHAR}" stroke-width="5"/><ellipse cx="300" cy="965" rx="90" ry="22" fill="${SAND}" stroke="${CHAR}" stroke-width="5"/><ellipse cx="300" cy="940" rx="90" ry="22" fill="#c9a15a" stroke="${CHAR}" stroke-width="5"/>`,
      ),
  },
  sharing: {
    alt: "Illustration of two simple figures facing each other across a table, with a big pile of coins on one side and a single coin slid across to the other",
    svg: () =>
      wrap(
        `<rect x="120" y="840" width="840" height="30" rx="12" fill="${CHAR}"/><rect x="190" y="870" width="24" height="200" fill="${CHAR}"/><rect x="866" y="870" width="24" height="200" fill="${CHAR}"/>
         <circle cx="260" cy="560" r="80" fill="${TEAL}"/><rect x="190" y="650" width="140" height="190" rx="50" fill="${TEAL}"/>
         <circle cx="820" cy="560" r="80" fill="${ORANGE}"/><rect x="750" y="650" width="140" height="190" rx="50" fill="${ORANGE}"/>
         ${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${380 + (i % 2) * 26}" cy="${820 - i * 22}" rx="56" ry="15" fill="${SAND}" stroke="${CHAR}" stroke-width="4"/>`).join("")}
         <ellipse cx="640" cy="826" rx="38" ry="11" fill="${SAND}" stroke="${CHAR}" stroke-width="4"/>
         <path d="M 450 760 Q 540 700 630 770" fill="none" stroke="${CHAR}" stroke-width="5" stroke-dasharray="4 14" stroke-linecap="round"/>`,
      ),
  },
  coinfall: {
    alt: "Illustration of an open hand held flat with one coin resting on it and another coin slipping off the fingertips with a dotted trail",
    svg: () => {
      const finger = (y: number, len: number) => `<rect x="640" y="${y}" width="${len}" height="62" rx="31" fill="${TEAL}" stroke="${DEEP}" stroke-width="5"/>`;
      return wrap(
        `<rect x="120" y="760" width="560" height="190" rx="70" fill="${TEAL}" stroke="${DEEP}" stroke-width="5"/>
         ${finger(768, 300)}${finger(836, 330)}${finger(904, 300)}
         <path d="M 220 770 C 300 690 420 690 470 760 Z" fill="${TEAL}" stroke="${DEEP}" stroke-width="5"/>
         <rect x="60" y="800" width="120" height="110" rx="40" fill="${DEEP}"/>
         <ellipse cx="380" cy="750" rx="84" ry="22" fill="${SAND}" stroke="${CHAR}" stroke-width="5"/><ellipse cx="380" cy="732" rx="84" ry="22" fill="#c9a15a" stroke="${CHAR}" stroke-width="5"/>
         <path d="M 930 740 C 960 600 940 520 900 470" fill="none" stroke="${CHAR}" stroke-width="5" stroke-dasharray="4 14" stroke-linecap="round"/>
         <circle cx="880" cy="720" r="58" fill="#c9a15a" stroke="${CHAR}" stroke-width="6"/><circle cx="880" cy="720" r="38" fill="none" stroke="${CHAR}" stroke-width="4" opacity="0.5"/>`,
      );
    },
  },
  pillars: {
    alt: "Illustration of a ring of tall T-shaped stone pillars on a hilltop at sunrise, with simple animal shapes carved on them",
    svg: () => {
      const pillar = (x: number, h: number, color: string, mark: string) =>
        `<g><rect x="${x - 20}" y="${980 - h}" width="40" height="${h}" fill="${color}"/><rect x="${x - 62}" y="${980 - h - 34}" width="124" height="48" rx="12" fill="${color}"/>${mark}</g>`;
      const mark = (x: number, h: number, kind: number) => {
        const y = 980 - h + 60;
        if (kind === 0) return `<circle cx="${x}" cy="${y}" r="9" fill="${CREAM}" opacity="0.7"/><path d="M ${x - 16} ${y + 30} q 16 -26 32 0" fill="none" stroke="${CREAM}" stroke-width="5" opacity="0.7"/>`;
        if (kind === 1) return `<path d="M ${x - 14} ${y} q 14 -18 28 0 t -28 24 t 28 24" fill="none" stroke="${CREAM}" stroke-width="5" opacity="0.7"/>`;
        return `<path d="M ${x - 14} ${y + 40} L ${x} ${y} L ${x + 14} ${y + 40} Z" fill="none" stroke="${CREAM}" stroke-width="5" opacity="0.7"/>`;
      };
      const spec: [number, number, string, number][] = [
        [250, 330, DEEP, 0],
        [410, 400, TEAL, 1],
        [570, 440, DEEP, 2],
        [730, 400, TEAL, 0],
        [890, 330, DEEP, 1],
      ];
      return wrap(
        `<circle cx="540" cy="520" r="190" fill="${ORANGE}" opacity="0.85"/><rect y="980" width="${W}" height="370" fill="${SAND}"/><path d="M 0 980 Q 540 900 1080 980 L 1080 1010 L 0 1010 Z" fill="#d6c59d"/>
         ${spec.map(([x, h, c, k]) => pillar(x, h, c, mark(x, h, k))).join("")}`,
      );
    },
  },
  blast: {
    alt: "Illustration of a forest seen from above with trees lying flat and pointing outward from a central point, under a glowing orange sky",
    svg: () => {
      let trees = "";
      const cx = 540;
      const cy = 760;
      for (let ring = 1; ring <= 5; ring++) {
        const count = ring * 8;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 * i) / count + ring * 0.2;
          const r = ring * 105 + 40;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a) * 0.82;
          const len = 52;
          const x2 = x + len * Math.cos(a);
          const y2 = y + len * Math.sin(a) * 0.82;
          trees += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${ring % 2 ? DEEP : TEAL}" stroke-width="9" stroke-linecap="round"/>`;
        }
      }
      return wrap(
        `<rect width="${W}" height="${H}" fill="#1c4a3f"/><circle cx="${cx}" cy="${cy}" r="110" fill="${ORANGE}" opacity="0.9"/><circle cx="${cx}" cy="${cy}" r="60" fill="#f6d28f"/>${trees}`,
        "#1c4a3f",
      );
    },
  },
  lipsound: {
    alt: "Illustration of a simple face in profile with curved sound-wave arcs coming from the mouth and a second set of arcs reaching the eye",
    svg: () =>
      wrap(
        `<path d="M 330 420 C 330 330 450 300 520 340 C 580 375 600 450 640 520 L 600 560 L 640 600 C 640 640 620 670 590 690 C 600 740 560 780 500 790 C 480 860 480 900 500 980 L 330 980 Z" fill="${TEAL}"/>
         <circle cx="470" cy="470" r="18" fill="${CREAM}"/><circle cx="470" cy="470" r="8" fill="${CHAR}"/>
         <path d="M 540 580 L 610 600 L 545 635" fill="none" stroke="${CREAM}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
         ${[0, 1, 2].map((i) => `<path d="M ${690 + i * 70} ${560 - i * 40} q ${40 + i * 10} ${50 + i * 40} 0 ${100 + i * 80}" fill="none" stroke="${ORANGE}" stroke-width="12" stroke-linecap="round"/>`).join("")}
         <path d="M 520 430 C 640 340 760 330 860 380" fill="none" stroke="${DEEP}" stroke-width="6" stroke-dasharray="4 16" stroke-linecap="round"/>`,
      ),
  },
  palace: {
    alt: "Illustration of a row of four arched doorways that shrink into the distance, each holding one simple object in a different colour",
    svg: () => {
      const doors: { x: number; w: number; h: number; color: string; obj: (cx: number, base: number, s: number) => string }[] = [
        { x: 90, w: 330, h: 560, color: TEAL, obj: (cx, base, s) => `<circle cx="${cx - 30 * s}" cy="${base - 150 * s}" r="${40 * s}" fill="${ORANGE}"/><rect x="${cx - 4 * s}" y="${base - 150 * s}" width="${150 * s}" height="${18 * s}" fill="${ORANGE}"/><rect x="${cx + 100 * s}" y="${base - 150 * s}" width="${18 * s}" height="${50 * s}" fill="${ORANGE}"/>` },
        { x: 380, w: 270, h: 470, color: DEEP, obj: (cx, base, s) => `<rect x="${cx - 70 * s}" y="${base - 170 * s}" width="${140 * s}" height="${110 * s}" rx="${8 * s}" fill="${SAND}"/><line x1="${cx}" y1="${base - 170 * s}" x2="${cx}" y2="${base - 60 * s}" stroke="${CHAR}" stroke-width="${6 * s}"/>` },
        { x: 610, w: 220, h: 390, color: ORANGE, obj: (cx, base, s) => `<ellipse cx="${cx}" cy="${base - 110 * s}" rx="${70 * s}" ry="${48 * s}" fill="${TEAL}"/><circle cx="${cx + 62 * s}" cy="${base - 150 * s}" r="${28 * s}" fill="${TEAL}"/><polygon points="${cx + 88 * s},${base - 150 * s} ${cx + 120 * s},${base - 142 * s} ${cx + 88 * s},${base - 132 * s}" fill="${CHAR}"/>` },
        { x: 800, w: 170, h: 310, color: TEAL, obj: (cx, base, s) => `<polygon points="${cx - 50 * s},${base - 60 * s} ${cx + 50 * s},${base - 60 * s} ${cx + 20 * s},${base - 150 * s} ${cx - 20 * s},${base - 150 * s}" fill="${SAND}"/><circle cx="${cx}" cy="${base - 170 * s}" r="${22 * s}" fill="${ORANGE}"/>` },
      ];
      let out = `<rect y="1000" width="${W}" height="350" fill="${SAND}"/><rect y="990" width="${W}" height="16" fill="${CHAR}" opacity="0.7"/>`;
      for (const d of doors) {
        const base = 990;
        const top = base - d.h;
        out += `<path d="M ${d.x} ${base} L ${d.x} ${top + d.w / 2} A ${d.w / 2} ${d.w / 2} 0 0 1 ${d.x + d.w} ${top + d.w / 2} L ${d.x + d.w} ${base} Z" fill="${d.color}" opacity="0.9"/>`;
        out += `<path d="M ${d.x + 22} ${base} L ${d.x + 22} ${top + d.w / 2} A ${d.w / 2 - 22} ${d.w / 2 - 22} 0 0 1 ${d.x + d.w - 22} ${top + d.w / 2} L ${d.x + d.w - 22} ${base} Z" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="5"/>`;
        out += d.obj(d.x + d.w / 2, base, d.w / 330);
      }
      return wrap(out);
    },
  },
  sleepmoon: {
    alt: "Illustration of a bed with a sleeping figure under a blanket and a crescent moon and stars in the window",
    svg: () =>
      wrap(
        `<rect x="220" y="320" width="640" height="440" rx="30" fill="${DEEP}"/>
         <path d="M 640 440 a 90 90 0 1 0 60 150 a 70 70 0 1 1 -60 -150 Z" fill="${SAND}"/>
         <circle cx="330" cy="430" r="6" fill="${CREAM}"/><circle cx="450" cy="520" r="5" fill="${CREAM}"/><circle cx="780" cy="680" r="6" fill="${CREAM}"/><circle cx="390" cy="660" r="4" fill="${CREAM}"/>
         <rect x="180" y="900" width="720" height="70" rx="20" fill="${CHAR}"/><rect x="180" y="960" width="40" height="140" fill="${CHAR}"/><rect x="860" y="960" width="40" height="140" fill="${CHAR}"/>
         <rect x="200" y="820" width="680" height="110" rx="40" fill="${TEAL}"/>
         <circle cx="300" cy="810" r="70" fill="#f1d9b5"/><rect x="230" y="800" width="620" height="140" rx="60" fill="${ORANGE}" opacity="0.9"/>`,
      ),
  },
  rubberhand: {
    alt: "Illustration of a hidden hand behind a screen and a visible rubber hand, both being stroked by paintbrushes",
    svg: () =>
      wrap(
        `<rect x="120" y="860" width="840" height="40" rx="14" fill="${CHAR}"/>
         <rect x="470" y="520" width="26" height="340" fill="${DEEP}"/>
         <g><rect x="200" y="780" width="200" height="80" rx="40" fill="${SAND}" stroke="${CHAR}" stroke-width="5" stroke-dasharray="10 12"/>${[0, 1, 2, 3].map((i) => `<rect x="${380 + i * 0}" y="${790 + i * 18}" width="60" height="16" rx="8" fill="${SAND}" stroke="${CHAR}" stroke-width="4" stroke-dasharray="6 8"/>`).join("")}</g>
         <g><rect x="620" y="780" width="200" height="80" rx="40" fill="#e8b48a" stroke="${CHAR}" stroke-width="5"/>${[0, 1, 2, 3].map((i) => `<rect x="${800 + i * 0}" y="${790 + i * 18}" width="60" height="16" rx="8" fill="#e8b48a" stroke="${CHAR}" stroke-width="4"/>`).join("")}</g>
         <g transform="translate(300 690) rotate(-35)"><rect x="-10" y="-150" width="20" height="150" rx="6" fill="${TEAL}"/><rect x="-16" y="0" width="32" height="46" rx="10" fill="${ORANGE}"/></g>
         <g transform="translate(720 690) rotate(35)"><rect x="-10" y="-150" width="20" height="150" rx="6" fill="${TEAL}"/><rect x="-16" y="0" width="32" height="46" rx="10" fill="${ORANGE}"/></g>`,
      ),
  },
  brickwindows: {
    alt: "Illustration of a plain brick house front with a grid of windows, some open and some filled in solid with brick",
    svg: () => {
      let win = "";
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          const x = 290 + c * 190;
          const y = 440 + r * 210;
          const filled = (r + c) % 2 === 1;
          win += filled
            ? `<rect x="${x}" y="${y}" width="120" height="150" rx="8" fill="#a65e3f"/><line x1="${x}" y1="${y + 50}" x2="${x + 120}" y2="${y + 50}" stroke="${CREAM}" stroke-width="4" opacity="0.6"/><line x1="${x}" y1="${y + 100}" x2="${x + 120}" y2="${y + 100}" stroke="${CREAM}" stroke-width="4" opacity="0.6"/>`
            : `<rect x="${x}" y="${y}" width="120" height="150" rx="8" fill="${SAND}" stroke="${CHAR}" stroke-width="6"/><line x1="${x + 60}" y1="${y}" x2="${x + 60}" y2="${y + 150}" stroke="${CHAR}" stroke-width="5"/><line x1="${x}" y1="${y + 75}" x2="${x + 120}" y2="${y + 75}" stroke="${CHAR}" stroke-width="5"/>`;
        }
      return wrap(`<rect x="230" y="340" width="620" height="700" rx="18" fill="#c97a56"/><polygon points="200,340 540,180 880,340" fill="${DEEP}"/>${win}<rect y="1040" width="${W}" height="310" fill="${SAND}"/>`);
    },
  },
  paperpromise: {
    alt: "Illustration of an old paper note with a woodblock-style border and seal, next to strings of round coins with square holes",
    svg: () => {
      let coins = "";
      for (let i = 0; i < 6; i++) coins += `<circle cx="${190 + i * 140}" cy="1010" r="52" fill="#c9a15a" stroke="${CHAR}" stroke-width="6"/><rect x="${190 + i * 140 - 14}" y="996" width="28" height="28" fill="${CREAM}" stroke="${CHAR}" stroke-width="4"/>`;
      return wrap(
        `<line x1="140" y1="1010" x2="940" y2="1010" stroke="${CHAR}" stroke-width="6"/>${coins}
         <rect x="220" y="360" width="640" height="500" rx="22" fill="#f9f1dc" stroke="${CHAR}" stroke-width="8"/>
         <rect x="260" y="400" width="560" height="420" rx="12" fill="none" stroke="${DEEP}" stroke-width="10" stroke-dasharray="26 10"/>
         <circle cx="540" cy="610" r="110" fill="${ORANGE}" opacity="0.85"/><rect x="500" y="570" width="80" height="80" fill="${CREAM}" opacity="0.9"/>
         <path d="M 320 480 L 440 480 M 640 480 L 760 480 M 320 760 L 440 760 M 640 760 L 760 760" stroke="${DEEP}" stroke-width="8" stroke-linecap="round" opacity="0.7"/>`,
      );
    },
  },
  mug: {
    alt: "Illustration of a plain ceramic mug on a table with soft steam rising",
    svg: () =>
      wrap(
        `<rect y="960" width="${W}" height="390" fill="${SAND}"/><rect y="950" width="${W}" height="20" fill="${CHAR}" opacity="0.7"/>
         <path d="M 380 620 L 700 620 L 680 930 Q 540 960 400 930 Z" fill="${TEAL}"/>
         <ellipse cx="540" cy="620" rx="160" ry="34" fill="${DEEP}"/>
         <path d="M 698 680 C 800 680 800 820 690 830" fill="none" stroke="${TEAL}" stroke-width="30" stroke-linecap="round"/>
         <path d="M 470 560 C 440 510 500 480 470 430 M 540 560 C 510 510 570 480 540 430 M 610 560 C 580 510 640 480 610 430" fill="none" stroke="${CHAR}" stroke-width="10" stroke-linecap="round" opacity="0.35"/>`,
      ),
  },
  disks: {
    alt: "Illustration of a stack of large flat round disks on a spindle with a thin arm reaching between two of them",
    svg: () => {
      let stack = "";
      for (let i = 0; i < 9; i++) stack += `<ellipse cx="540" cy="${900 - i * 62}" rx="300" ry="54" fill="${i % 2 ? TEAL : DEEP}" stroke="${CHAR}" stroke-width="4"/>`;
      return wrap(
        `<rect y="960" width="${W}" height="390" fill="${SAND}"/>${stack}<rect x="526" y="340" width="28" height="610" fill="${CHAR}"/>
         <path d="M 920 590 L 600 590" stroke="${ORANGE}" stroke-width="14" stroke-linecap="round"/><rect x="900" y="560" width="70" height="60" rx="10" fill="${ORANGE}"/>`,
      );
    },
  },
  phone: {
    alt: "Illustration of a chunky old mobile phone with a speech bubble on its screen and a radio-wave arc sending a second bubble away",
    svg: () =>
      wrap(
        `<rect x="330" y="360" width="300" height="640" rx="56" fill="${DEEP}"/>
         <rect x="368" y="430" width="224" height="170" rx="16" fill="${SAND}"/>
         <path d="M 400 470 h 130 a 14 14 0 0 1 14 14 v 40 a 14 14 0 0 1 -14 14 h -90 l -30 24 v -24 h -10 a 14 14 0 0 1 -14 -14 v -40 a 14 14 0 0 1 14 -14 Z" fill="${TEAL}"/>
         ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<circle cx="${400 + (i % 3) * 80}" cy="${680 + Math.floor(i / 3) * 90}" r="26" fill="${CREAM}" opacity="0.8"/>`).join("")}
         <rect x="470" y="300" width="20" height="80" rx="8" fill="${CHAR}"/>
         ${[0, 1, 2].map((i) => `<path d="M ${690 + i * 60} ${480 - i * 40} q ${40} ${90 + i * 40} 0 ${180 + i * 80}" fill="none" stroke="${ORANGE}" stroke-width="12" stroke-linecap="round" opacity="${1 - i * 0.2}"/>`).join("")}`,
      ),
  },
  atmail: {
    alt: "Illustration of a bold at-sign over a simple envelope, with an arrow between two simple computer boxes",
    svg: () =>
      wrap(
        `<rect x="260" y="560" width="560" height="380" rx="24" fill="#f9f1dc" stroke="${CHAR}" stroke-width="8"/>
         <path d="M 260 580 L 540 790 L 820 580" fill="none" stroke="${CHAR}" stroke-width="8" stroke-linejoin="round"/>
         <circle cx="540" cy="520" r="150" fill="${TEAL}"/>
         <circle cx="540" cy="520" r="52" fill="none" stroke="${CREAM}" stroke-width="22"/>
         <path d="M 592 520 v 28 a 34 34 0 0 0 68 0 v -28 a 120 120 0 1 0 -52 98" fill="none" stroke="${CREAM}" stroke-width="22" stroke-linecap="round"/>
         <rect x="130" y="1060" width="200" height="130" rx="16" fill="${DEEP}"/><rect x="750" y="1060" width="200" height="130" rx="16" fill="${DEEP}"/>
         <path d="M 360 1125 L 700 1125 M 660 1090 L 700 1125 L 660 1160" fill="none" stroke="${ORANGE}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`,
      ),
  },
  disc: {
    alt: "Illustration of a shiny round disc with a central hole and concentric rings, with a thin beam of light touching its surface",
    svg: () =>
      wrap(
        `<circle cx="540" cy="760" r="330" fill="#c8d6dc" stroke="${CHAR}" stroke-width="8"/>
         ${[290, 250, 210, 170, 130].map((r, i) => `<circle cx="540" cy="760" r="${r}" fill="none" stroke="${i % 2 ? TEAL : ORANGE}" stroke-width="10" opacity="0.45"/>`).join("")}
         <circle cx="540" cy="760" r="62" fill="${CREAM}" stroke="${CHAR}" stroke-width="8"/><circle cx="540" cy="760" r="100" fill="none" stroke="${CHAR}" stroke-width="6" opacity="0.6"/>
         <path d="M 880 420 L 640 650" stroke="${ORANGE}" stroke-width="12" stroke-linecap="round"/><circle cx="640" cy="650" r="14" fill="${ORANGE}"/>`,
      ),
  },
  kikibouba: {
    alt: "Illustration of a smooth round circle next to a sharp spiky star shape",
    svg: () => {
      const spikes = 12;
      const pts = Array.from({ length: spikes * 2 }, (_, i) => {
        const a = (Math.PI / spikes) * i - Math.PI / 2;
        const r = i % 2 ? 95 : 210;
        return `${(800 + r * Math.cos(a)).toFixed(1)},${(680 + r * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      return wrap(`<circle cx="330" cy="680" r="190" fill="${TEAL}"/><polygon points="${pts}" fill="${ORANGE}"/>`);
    },
  },
  cab: {
    alt: "Illustration of a boxy black taxi in profile on a street with a winding street-map line behind it",
    svg: () =>
      wrap(
        `<path d="M 100 520 C 260 380 420 600 560 460 C 700 320 820 560 980 420" fill="none" stroke="${TEAL}" stroke-width="10" stroke-dasharray="6 18" stroke-linecap="round" opacity="0.7"/>
         <path d="M 120 520 C 300 560 500 400 700 520 C 800 580 900 500 980 560" fill="none" stroke="${ORANGE}" stroke-width="8" stroke-dasharray="4 16" stroke-linecap="round" opacity="0.6"/>
         <rect y="1000" width="${W}" height="350" fill="${SAND}"/><rect y="990" width="${W}" height="16" fill="${CHAR}" opacity="0.7"/>
         <path d="M 150 940 L 150 800 Q 150 760 190 760 L 300 760 L 360 650 Q 380 620 420 620 L 700 620 Q 740 620 760 650 L 820 760 L 900 760 Q 940 760 940 800 L 940 940 Z" fill="${CHAR}"/>
         <path d="M 390 690 L 340 760 L 520 760 L 520 690 Z M 560 690 L 560 760 L 770 760 L 725 690 Z" fill="#9fb8c0"/>
         <rect x="470" y="585" width="150" height="34" rx="10" fill="${ORANGE}"/>
         <circle cx="320" cy="960" r="64" fill="#101820"/><circle cx="320" cy="960" r="26" fill="${SAND}"/>
         <circle cx="770" cy="960" r="64" fill="#101820"/><circle cx="770" cy="960" r="26" fill="${SAND}"/>`,
      ),
  },
  carcrash: {
    alt: "Illustration of two simple cartoon cars meeting nose to nose on a plain road with a starburst at the contact point",
    svg: () => {
      const star = Array.from({ length: 16 }, (_, i) => {
        const a = (Math.PI / 8) * i;
        const r = i % 2 ? 55 : 115;
        return `${(540 + r * Math.cos(a)).toFixed(1)},${(770 + r * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      // One car drawn facing right in local coordinates 0..340; the second is the same car mirrored.
      const car = (color: string) =>
        `<rect x="0" y="760" width="340" height="110" rx="34" fill="${color}"/><path d="M 60 760 L 100 690 Q 110 672 140 672 L 230 672 Q 260 672 275 700 L 300 760 Z" fill="${color}"/><circle cx="80" cy="880" r="42" fill="${CHAR}"/><circle cx="260" cy="880" r="42" fill="${CHAR}"/><circle cx="80" cy="880" r="16" fill="${SAND}"/><circle cx="260" cy="880" r="16" fill="${SAND}"/>`;
      return wrap(
        `<rect y="920" width="${W}" height="430" fill="${SAND}"/><rect y="910" width="${W}" height="14" fill="${CHAR}" opacity="0.7"/>
         <g transform="translate(160 0)">${car(TEAL)}</g>
         <g transform="translate(920 0) scale(-1 1)">${car(DEEP)}</g>
         <polygon points="${star}" fill="${ORANGE}"/>`,
      );
    },
  },
  wug: {
    alt: "Illustration of a friendly made-up bird-like creature standing next to a second identical creature",
    svg: () => {
      const wug = (cx: number, cy: number, s: number, color: string) =>
        `<g transform="translate(${cx} ${cy}) scale(${s})"><ellipse cx="0" cy="0" rx="120" ry="140" fill="${color}"/><path d="M -120 20 Q -190 -20 -170 -90 Q -120 -40 -100 -20 Z" fill="${color}"/><path d="M 120 20 Q 190 -20 170 -90 Q 120 -40 100 -20 Z" fill="${color}"/><circle cx="-42" cy="-50" r="26" fill="#fbf5e6"/><circle cx="42" cy="-50" r="26" fill="#fbf5e6"/><circle cx="-38" cy="-46" r="11" fill="${CHAR}"/><circle cx="46" cy="-46" r="11" fill="${CHAR}"/><polygon points="-22,-10 22,-10 0,32" fill="${ORANGE}"/><rect x="-70" y="130" width="22" height="50" fill="${ORANGE}"/><rect x="48" y="130" width="22" height="50" fill="${ORANGE}"/><path d="M -20 -150 q 20 -50 40 0" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/></g>`;
      return wrap(`<rect y="980" width="${W}" height="370" fill="${SAND}"/>${wug(340, 760, 1.05, TEAL)}${wug(760, 790, 0.85, "#2a9d8f")}`);
    },
  },
  splitbrain: {
    alt: "Illustration of a brain drawn as two rounded halves in different colours joined by a thin bridge in the middle",
    svg: () =>
      wrap(
        `<path d="M 520 440 C 420 380 250 400 200 540 C 150 660 220 780 330 810 C 400 900 480 880 520 820 Z" fill="${TEAL}"/>
         <path d="M 560 440 C 660 380 830 400 880 540 C 930 660 860 780 750 810 C 680 900 600 880 560 820 Z" fill="${ORANGE}"/>
         <rect x="500" y="610" width="80" height="44" rx="14" fill="${CHAR}" opacity="0.85"/>
         <path d="M 300 520 q 50 -30 100 10 M 270 640 q 70 -30 120 20 M 330 740 q 50 -30 100 10" fill="none" stroke="${CREAM}" stroke-width="8" stroke-linecap="round" opacity="0.55"/>
         <path d="M 780 520 q -50 -30 -100 10 M 810 640 q -70 -30 -120 20 M 750 740 q -50 -30 -100 10" fill="none" stroke="${CREAM}" stroke-width="8" stroke-linecap="round" opacity="0.55"/>`,
      ),
  },
  brainenergy: {
    alt: "Illustration of a brain silhouette with a lightning bolt at its centre",
    svg: () =>
      wrap(
        `<path d="M 540 440 C 440 380 250 400 200 540 C 150 660 220 780 330 810 C 400 900 480 880 540 820 C 600 880 680 900 750 810 C 860 780 930 660 880 540 C 830 400 640 380 540 440 Z" fill="${TEAL}"/>
         <path d="M 300 520 q 50 -30 100 10 M 270 640 q 70 -30 120 20 M 330 740 q 50 -30 100 10 M 780 520 q -50 -30 -100 10 M 810 640 q -70 -30 -120 20 M 750 740 q -50 -30 -100 10" fill="none" stroke="#7fd1c7" stroke-width="9" stroke-linecap="round" opacity="0.7"/>
         <polygon points="575,470 465,690 545,690 505,850 645,620 560,620 625,470" fill="${ORANGE}" stroke="${CREAM}" stroke-width="9" stroke-linejoin="round"/>`,
      ),
  },
  pascaltri: {
    alt: "Illustration of a triangle of stacked circles in rows of one, two, three, four, five and six",
    svg: () => {
      let out = "";
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c <= r; c++) {
          const x = 540 + (c - r / 2) * 150;
          const y = 430 + r * 120;
          out += `<circle cx="${x}" cy="${y}" r="52" fill="${(r + c) % 2 ? TEAL : ORANGE}" opacity="${0.55 + r * 0.08}"/>`;
        }
      }
      return wrap(out);
    },
  },
  zerostone: {
    alt: "Illustration of a sandstone slab carved with a row of tally marks ending in one small round circle, under a soft sun",
    svg: () => {
      let marks = "";
      for (let i = 0; i < 5; i++) marks += `<rect x="${290 + i * 80}" y="600" width="22" height="170" rx="8" fill="${CHAR}" opacity="0.75"/>`;
      return wrap(
        `<circle cx="840" cy="360" r="110" fill="${ORANGE}" opacity="0.85"/>
         <rect x="200" y="470" width="680" height="470" rx="50" fill="#d9b77e" stroke="${CHAR}" stroke-width="8"/>
         <path d="M 240 530 L 840 530 M 240 880 L 840 880" stroke="${CHAR}" stroke-width="5" opacity="0.3"/>
         ${marks}<circle cx="745" cy="685" r="62" fill="none" stroke="${CHAR}" stroke-width="22" opacity="0.85"/>
         <rect y="980" width="${W}" height="370" fill="${SAND}"/>`,
      );
    },
  },
  cray: {
    alt: "Illustration of a computer cabinet made of a row of dark columns in an arc, with a round padded bench around its base",
    svg: () => {
      const heights = [380, 430, 465, 485, 485, 465, 430, 380];
      let cols = "";
      heights.forEach((h, i) => {
        const x = 205 + i * 96;
        cols += `<rect x="${x}" y="${880 - h}" width="76" height="${h}" rx="22" fill="${i % 2 ? DEEP : "#16556a"}"/>`;
      });
      return wrap(
        `<rect y="990" width="${W}" height="360" fill="${SAND}"/>
         <ellipse cx="540" cy="890" rx="440" ry="110" fill="${ORANGE}"/><ellipse cx="540" cy="870" rx="400" ry="88" fill="#e9a05a"/>
         ${cols}
         <path d="M 130 900 Q 540 1010 950 900" fill="none" stroke="${ORANGE}" stroke-width="40" stroke-linecap="round"/>`,
      );
    },
  },
  floppy: {
    alt: "Illustration of a dark blue square floppy disk with a silver metal shutter and a plain white label",
    svg: () =>
      wrap(
        `<path d="M 260 380 L 760 380 L 840 460 L 840 960 Q 840 990 810 990 L 290 990 Q 260 990 260 960 Z" fill="${DEEP}"/>
         <rect x="400" y="380" width="300" height="190" rx="12" fill="#c8d6dc"/><rect x="590" y="410" width="60" height="130" rx="8" fill="${DEEP}"/>
         <rect x="330" y="680" width="450" height="270" rx="16" fill="#fbf5e6"/>
         <path d="M 370 740 L 740 740 M 370 800 L 740 800 M 370 860 L 640 860" stroke="${CHAR}" stroke-width="10" stroke-linecap="round" opacity="0.25"/>`,
      ),
  },
  tux: {
    alt: "Illustration of a friendly black-and-white penguin with a yellow beak and feet on a soft blue background",
    svg: () =>
      wrap(
        `<circle cx="540" cy="720" r="420" fill="#cfe3ea"/>
         <ellipse cx="540" cy="740" rx="230" ry="320" fill="${CHAR}"/>
         <ellipse cx="540" cy="800" rx="150" ry="230" fill="#fbf5e6"/>
         <path d="M 330 700 Q 230 800 270 920 Q 330 840 360 780 Z" fill="${CHAR}"/><path d="M 750 700 Q 850 800 810 920 Q 750 840 720 780 Z" fill="${CHAR}"/>
         <circle cx="470" cy="560" r="44" fill="#fbf5e6"/><circle cx="610" cy="560" r="44" fill="#fbf5e6"/><circle cx="478" cy="566" r="18" fill="${CHAR}"/><circle cx="602" cy="566" r="18" fill="${CHAR}"/>
         <polygon points="480,630 600,630 540,700" fill="#f0b429"/>
         <ellipse cx="450" cy="1000" rx="90" ry="34" fill="#f0b429"/><ellipse cx="630" cy="1000" rx="90" ry="34" fill="#f0b429"/>`,
      ),
  },
  torsion: {
    alt: "Illustration of a horizontal rod hanging from a thin thread with a small sphere at each end and two larger spheres beside it",
    svg: () =>
      wrap(
        `<line x1="540" y1="300" x2="540" y2="640" stroke="${CREAM}" stroke-width="6" opacity="0.8"/>
         <rect x="300" y="636" width="480" height="16" rx="8" fill="${SAND}"/>
         <circle cx="300" cy="644" r="40" fill="${ORANGE}"/><circle cx="780" cy="644" r="40" fill="${ORANGE}"/>
         <circle cx="180" cy="760" r="120" fill="${TEAL}"/><circle cx="900" cy="528" r="120" fill="${TEAL}"/>
         <ellipse cx="540" cy="960" rx="360" ry="60" fill="#06222c"/><rect x="520" y="300" width="40" height="40" rx="8" fill="${SAND}"/>
         <path d="M 220 700 A 330 330 0 0 1 860 700" fill="none" stroke="${CREAM}" stroke-width="5" stroke-dasharray="4 16" stroke-linecap="round" opacity="0.5"/>`,
        DEEP,
      ),
  },
  petri: {
    alt: "Illustration of a round petri dish seen from above with a fuzzy mould blob on one side and a clear halo around it where small dots are missing",
    svg: () => {
      let dots = "";
      for (let i = 0; i < 70; i++) {
        const a = i * 2.399;
        const r = 60 + ((i * 53) % 300);
        const x = 540 + r * Math.cos(a);
        const y = 700 + r * Math.sin(a);
        const dx = x - 400;
        const dy = y - 600;
        if (Math.sqrt(dx * dx + dy * dy) < 210) continue;
        if (Math.sqrt((x - 540) ** 2 + (y - 700) ** 2) > 340) continue;
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${9 + (i % 3) * 3}" fill="${ORANGE}" opacity="0.8"/>`;
      }
      return wrap(
        `<circle cx="540" cy="700" r="400" fill="#dff0ee" stroke="${CHAR}" stroke-width="10"/>
         <circle cx="540" cy="700" r="365" fill="#f3d9a0" opacity="0.65"/>
         <circle cx="400" cy="600" r="200" fill="#fbf0d0" opacity="0.9"/>
         ${dots}
         <path d="M 330 600 C 330 520 450 500 470 560 C 530 540 560 620 500 650 C 520 710 420 740 380 690 C 320 700 290 640 330 600 Z" fill="#4c9a8c"/>`,
        TEAL,
      );
    },
  },
  chessboard: {
    alt: "Illustration of a chessboard whose squares hold piles of grains that grow larger from one square to the next",
    svg: () => {
      let out = "";
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const i = r * 8 + c;
          const x = 220 + c * 80;
          const y = 520 + r * 80;
          out += `<rect x="${x}" y="${y}" width="80" height="80" fill="${(r + c) % 2 ? DEEP : SAND}"/><circle cx="${x + 40}" cy="${y + 40}" r="${(3 + (i / 63) ** 2.2 * 34).toFixed(1)}" fill="${ORANGE}"/>`;
        }
      }
      return wrap(`${out}<rect x="212" y="512" width="656" height="656" fill="none" stroke="${CHAR}" stroke-width="16" rx="6"/>`);
    },
  },
  googol: {
    alt: "Illustration of one tall bar followed by rows of small empty rings stretching off to the right",
    svg: () => {
      let rings = "";
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 9; c++) {
          const x = 330 + c * 85;
          const y = 540 + r * 120;
          rings += `<circle cx="${x}" cy="${y}" r="30" fill="none" stroke="${r % 2 ? ORANGE : TEAL}" stroke-width="14" opacity="${(1 - c * 0.08).toFixed(2)}"/>`;
        }
      }
      return wrap(`<rect x="150" y="480" width="70" height="420" rx="30" fill="${CHAR}"/>${rings}`);
    },
  },
  perfect: {
    alt: "Illustration of three short bars of length one, two and three that together make a single bar of length six",
    svg: () => {
      const u = 120;
      const bar = (x: number, y: number, n: number, color: string) => `<rect x="${x}" y="${y}" width="${n * u - 10}" height="90" rx="20" fill="${color}"/>`;
      return wrap(
        `${bar(180, 520, 1, TEAL)}${bar(180, 650, 2, ORANGE)}${bar(180, 780, 3, DEEP)}
         ${bar(180, 960, 1, TEAL)}${bar(180 + u, 960, 2, ORANGE)}${bar(180 + 3 * u, 960, 3, DEEP)}`,
      );
    },
  },
  degrees: {
    alt: "Illustration of a circle divided into twelve equal wedges in alternating colours, with small tick marks around the rim",
    svg: () => {
      let wedges = "";
      let ticks = "";
      const cx = 540;
      const cy = 740;
      const R = 330;
      for (let i = 0; i < 12; i++) {
        const a0 = (i * 30 - 90) * (Math.PI / 180);
        const a1 = ((i + 1) * 30 - 90) * (Math.PI / 180);
        wedges += `<path d="M ${cx} ${cy} L ${(cx + R * Math.cos(a0)).toFixed(1)} ${(cy + R * Math.sin(a0)).toFixed(1)} A ${R} ${R} 0 0 1 ${(cx + R * Math.cos(a1)).toFixed(1)} ${(cy + R * Math.sin(a1)).toFixed(1)} Z" fill="${i % 2 ? TEAL : ORANGE}" opacity="0.88"/>`;
      }
      for (let i = 0; i < 72; i++) {
        const a = (i * 5 - 90) * (Math.PI / 180);
        const r1 = i % 6 ? R + 18 : R + 36;
        ticks += `<line x1="${(cx + (R + 6) * Math.cos(a)).toFixed(1)}" y1="${(cy + (R + 6) * Math.sin(a)).toFixed(1)}" x2="${(cx + r1 * Math.cos(a)).toFixed(1)}" y2="${(cy + r1 * Math.sin(a)).toFixed(1)}" stroke="${CHAR}" stroke-width="5" stroke-linecap="round"/>`;
      }
      return wrap(`${wedges}<circle cx="${cx}" cy="${cy}" r="26" fill="${CHAR}"/>${ticks}`);
    },
  },
  bigprime: {
    alt: "Illustration of a grid of small dots fading into the distance with one bright orange dot among them",
    svg: () => {
      let dots = "";
      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 10; c++) {
          const x = 180 + c * 80;
          const y = 440 + r * 66;
          const hit = r === 7 && c === 6;
          dots += `<circle cx="${x}" cy="${y}" r="${hit ? 30 : 13}" fill="${hit ? ORANGE : TEAL}" opacity="${hit ? 1 : (0.9 - r * 0.055).toFixed(2)}"/>`;
        }
      }
      return wrap(dots);
    },
  },
  fibsquares: {
    alt: "Illustration of squares of growing sizes fitted together into a rectangle, each square a little bigger than the one before",
    svg: () => {
      const u = 62;
      const sq: [number, number, number, string][] = [
        [0, 0, 1, ORANGE],
        [1, 0, 1, TEAL],
        [0, 1, 2, DEEP],
        [2, 0, 3, ORANGE],
        [0, 3, 5, TEAL],
        [5, 0, 8, DEEP],
      ];
      const x0 = (W - 13 * u) / 2;
      const y0 = 470;
      return wrap(
        sq
          .map(([x, y, s, color]) => `<rect x="${x0 + x * u + 4}" y="${y0 + y * u + 4}" width="${s * u - 8}" height="${s * u - 8}" rx="10" fill="${color}" opacity="0.9"/>`)
          .join(""),
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
