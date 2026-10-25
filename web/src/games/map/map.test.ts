import { describe, expect, it } from "vitest";
import { loadMap } from "./mapData";
import { buildRound, countryAt, countryPool, DEFAULT_SETTINGS, judge, mountainPool, pointInRings, project, regionBox, riverPool, type Target } from "./mapLogic";

const data = await loadMap();
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const country = (name: string): Target => ({ kind: "country", country: data.countries.find((c) => c.name === name)! });

describe("map data", () => {
  it("has what the game needs", () => {
    expect(data.countries.length).toBeGreaterThan(150);
    expect(data.rivers.length).toBeGreaterThan(25);
    expect(data.mountains.length).toBeGreaterThan(20);
    expect(new Set(data.countries.map((c) => c.id)).size).toBe(data.countries.length);
    // The iOS app decodes these as whole numbers, so a decimal here would stop the map loading there.
    for (const c of data.countries) {
      for (const n of [c.pop, c.area, ...c.label]) expect(Number.isInteger(n), c.name).toBe(true);
    }
    for (const c of data.countries) {
      expect(c.rings.length, c.name).toBeGreaterThan(0);
      for (const r of c.rings) {
        expect(r.length % 2, c.name).toBe(0);
        for (const v of r) expect(v >= 0 && v <= data.w + 1, c.name).toBe(true);
      }
    }
  });
});

describe("hit testing", () => {
  it("finds the country under a point, and nothing at sea", () => {
    const [px, py] = project(2.35, 48.85);
    expect(countryAt(data, px, py)?.name).toBe("France");
    const [bx, by] = project(139.7, 35.7);
    expect(countryAt(data, bx, by)?.name).toBe("Japan");
    const [sx, sy] = project(-30, 0);
    expect(countryAt(data, sx, sy)).toBeNull();
  });

  it("point in a square", () => {
    const square = [[0, 0, 10, 0, 10, 10, 0, 10]];
    expect(pointInRings(5, 5, square)).toBe(true);
    expect(pointInRings(15, 5, square)).toBe(false);
  });

  it("judges a country tap, and says what was tapped when it was wrong", () => {
    const [x, y] = project(2.35, 48.85);
    expect(judge(data, country("France"), x, y)).toEqual({ correct: true, tapped: null });
    const wrong = judge(data, country("Germany"), x, y);
    expect(wrong.correct).toBe(false);
    expect(wrong.tapped).toBe("France");
  });

  it("gives small countries a generous circle", () => {
    const lux = data.countries.find((c) => c.name.startsWith("Luxembourg"));
    if (!lux) return;
    const target: Target = { kind: "country", country: lux };
    expect(judge(data, target, lux.label[0] + 60, lux.label[1] + 60).correct).toBe(true);
    expect(judge(data, target, lux.label[0] + 900, lux.label[1]).correct).toBe(false);
  });

  it("judges rivers and mountains by distance", () => {
    const nile = data.rivers.find((r) => r.name === "Nile")!;
    const [rx, ry] = [nile.lines[0]![0]!, nile.lines[0]![1]!];
    expect(judge(data, { kind: "river", river: nile }, rx + 20, ry + 20).correct).toBe(true);
    expect(judge(data, { kind: "river", river: nile }, rx + 2000, ry + 2000).correct).toBe(false);
    const everest = data.mountains.find((m) => m.name === "Mount Everest")!;
    expect(judge(data, { kind: "mountain", mountain: everest }, everest.at[0] + 50, everest.at[1]).correct).toBe(true);
    expect(judge(data, { kind: "mountain", mountain: everest }, everest.at[0] + 1000, everest.at[1]).correct).toBe(false);
  });
});

describe("regions", () => {
  it("shows Europe around Paris and not around Tokyo", () => {
    const [x, y, w, h] = regionBox(data, "Europe");
    const [px, py] = project(2.35, 48.85);
    const [tx] = project(139.7, 35.7);
    expect(px >= x && px <= x + w && py >= y && py <= y + h).toBe(true);
    expect(tx > x + w).toBe(true);
    expect(regionBox(data, "World")).toEqual([0, 0, data.w, data.h]);
  });

  it("pools respect the region and the difficulty", () => {
    const easy = countryPool(data, "Europe", 1);
    const hard = countryPool(data, "Europe", 3);
    expect(easy.length).toBeLessThan(hard.length);
    for (const c of hard) expect(c.continent).toBe("Europe");
    expect(riverPool(data, "Europe").some((r) => r.name === "Danube")).toBe(true);
    expect(mountainPool(data, "Africa", 3).every((m) => m.continent === "Africa")).toBe(true);
  });
});

describe("rounds", () => {
  it("never repeats a question and respects the length", () => {
    const round = buildRound(data, { subject: "countries", region: "World", difficulty: 2 }, seeded(), 20);
    expect(round).toHaveLength(20);
    const names = round.map((t) => (t.kind === "country" ? t.country.id : ""));
    expect(new Set(names).size).toBe(20);
  });

  it("a mixed round asks about more than countries", () => {
    const round = buildRound(data, { subject: "mixed", region: "World", difficulty: 2 }, seeded(7), 12);
    expect(new Set(round.map((t) => t.kind)).size).toBeGreaterThan(1);
  });

  it("is short, not broken, when a region has little to ask about", () => {
    const round = buildRound(data, { subject: "rivers", region: "Oceania", difficulty: 1 }, seeded(), 20);
    expect(round.length).toBeLessThan(20);
    expect(buildRound(data, DEFAULT_SETTINGS, seeded(), 5)).toHaveLength(5);
  });
});
