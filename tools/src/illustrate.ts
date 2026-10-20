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
