/**
 * Builds content/games/map.json for the Map game: country outlines, famous rivers and mountains, all in one flat coordinate system
 * (0 to 10000 across, Miller projection) that both apps draw directly.
 *
 * Source: Natural Earth (public domain), https://www.naturalearthdata.com. Download these three files into one folder first:
 *   ne_50m_admin_0_countries.geojson, ne_50m_rivers_lake_centerlines.geojson  (from github.com/nvkelso/natural-earth-vector, geojson/)
 * Run: pnpm --filter tools exec tsx src/games/map-gen.ts <folder with the files>
 * Outlines are simplified so the file stays small; the output is deterministic.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: map-gen.ts <folder with the Natural Earth geojson files>");
  process.exit(1);
}

type Pt = [number, number];
const W = 10000;
const LAT_MIN = -56;
const LAT_MAX = 84;
const rad = (d: number) => (d * Math.PI) / 180;
const miller = (lat: number) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * rad(lat)));
const yTop = miller(LAT_MAX);
const scale = W / (2 * Math.PI);
/** Longitude and latitude in degrees to map units. */
function project(lon: number, lat: number): Pt {
  const la = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
  return [Math.round(((rad(lon) + Math.PI) / (2 * Math.PI)) * W), Math.round((yTop - miller(la)) * scale)];
}
const H = Math.round((yTop - miller(LAT_MIN)) * scale);

function perpendicular(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
/** Douglas-Peucker: drops points that sit within `tol` of the straight line between their neighbours. */
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts;
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicular(pts[i]!, pts[0]!, pts[pts.length - 1]!);
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= tol) return [pts[0]!, pts[pts.length - 1]!];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}
const area = (ring: Pt[]) => Math.abs(ring.reduce((s, p, i) => s + (ring[(i + 1) % ring.length]![0] - p[0]) * (ring[(i + 1) % ring.length]![1] + p[1]), 0)) / 2;
const flat = (pts: Pt[]) => pts.flatMap((p) => p);

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
const read = (name: string): Feature[] => (JSON.parse(readFileSync(resolve(dir, name), "utf8")) as { features: Feature[] }).features;

// Countries ---------------------------------------------------------------------------------------------------------------
const KEEP_TYPES = new Set(["Sovereign country", "Country", "Disputed", "Sovereignty"]);
const EXTRA = new Set(["Greenland"]);
const countries = read("ne_50m_admin_0_countries.geojson")
  .filter((f) => {
    const p = f.properties;
    const continent = String(p.CONTINENT);
    if (continent === "Antarctica" || continent.startsWith("Seven seas")) return false;
    return KEEP_TYPES.has(String(p.TYPE)) || EXTRA.has(String(p.NAME));
  })
  .map((f) => {
    const p = f.properties;
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    const rings: Pt[][] = [];
    for (const poly of polys) {
      const outer = poly[0]!.map(([lon, lat]) => project(lon!, lat!));
      rings.push(outer);
    }
    const sizes = rings.map(area);
    const biggest = Math.max(...sizes);
    const kept = rings
      .map((r, i) => ({ r, a: sizes[i]! }))
      // Keep the main land and islands big enough to see; always keep the largest piece (small countries).
      .filter((x) => x.a === biggest || x.a >= 400)
      .map((x) => {
        // Tiny countries: keep more detail, and if the outline still collapses, draw a small square so it can be seen and tapped.
        const rough = simplify(x.r, 4);
        if (rough.length >= 4) return rough;
        const fine = simplify(x.r, 0.5);
        if (fine.length >= 4) return fine;
        const cx = Math.round(x.r.reduce((s, p) => s + p[0], 0) / x.r.length);
        const cy = Math.round(x.r.reduce((s, p) => s + p[1], 0) / x.r.length);
        return [[cx - 10, cy - 10], [cx + 10, cy - 10], [cx + 10, cy + 10], [cx - 10, cy + 10]] as Pt[];
      })
      .filter((r) => r.length >= 4);
    const nameLong = String(p.NAME_LONG);
    const name = nameLong.length <= 24 ? nameLong : String(p.NAME);
    const label = project(Number(p.LABEL_X), Number(p.LABEL_Y));
    return {
      id: String(p.ADM0_A3),
      name,
      continent: String(p.CONTINENT),
      pop: Number(p.POP_EST),
      area: Math.round(biggest),
      label,
      rings: kept.map(flat),
    };
  })
  .sort((a, b) => b.pop - a.pop);

// Rivers: a hand-picked list of well-known ones; the English names Natural Earth uses are matched here -------------------
const RIVERS: Record<string, string[]> = {
  Nile: ["Nile", "El Bahr el Abyad", "Bahr el Jebel", "Albert Nile", "Victoria Nile"],
  Amazon: ["Amazon", "Amazonas", "Solimões"],
  Mississippi: ["Mississippi"],
  Missouri: ["Missouri"],
  Yangtze: ["Yangtze", "Chang Jiang", "Jinsha"],
  "Yellow River": ["Yellow", "Huang"],
  Mekong: ["Mekong", "Lancang"],
  Ganges: ["Ganges"],
  Brahmaputra: ["Brahmaputra", "Dihang"],
  Indus: ["Indus"],
  Danube: ["Danube", "Donau"],
  Volga: ["Volga"],
  Dnieper: ["Dnieper", "Dnipro"],
  Don: ["Don"],
  Ob: ["Ob", "Ob'"],
  Yenisei: ["Yenisei", "Yenisey"],
  Lena: ["Lena"],
  Amur: ["Amur", "Heilong Jiang"],
  Congo: ["Congo", "Lualaba"],
  Niger: ["Niger"],
  Zambezi: ["Zambezi"],
  "Orange River": ["Orange"],
  Euphrates: ["Euphrates", "Al Furat", "Firat"],
  Tigris: ["Tigris", "Dicle"],
  Colorado: ["Colorado"],
  Columbia: ["Columbia"],
  "Rio Grande": ["Rio Grande", "Grande"],
  Mackenzie: ["Mackenzie"],
  Yukon: ["Yukon"],
  "St. Lawrence": ["St. Lawrence", "Saint Lawrence"],
  Orinoco: ["Orinoco"],
  Paraná: ["Paraná", "Parana"],
  Murray: ["Murray"],
  Irrawaddy: ["Irrawaddy", "Ayeyarwady"],
  Rhine: ["Rhine", "Rhein"],
  Rhône: ["Rhône", "Rhone"],
  Elbe: ["Elbe"],
  Vistula: ["Vistula", "Wisła"],
  Ural: ["Ural"],
  Limpopo: ["Limpopo"],
  Volta: ["Volta"],
  Senegal: ["Senegal"],
  Saskatchewan: ["Saskatchewan"],
  Ohio: ["Ohio"],
};
const riverFeatures = read("ne_50m_rivers_lake_centerlines.geojson").filter((f) => {
  const p = f.properties;
  return f.geometry && (String(p.featurecla) === "River" || String(p.featurecla) === "Lake Centerline");
});
const rivers: { name: string; lines: number[][] }[] = [];
const missing: string[] = [];
for (const [display, aliases] of Object.entries(RIVERS)) {
  const wanted = new Set(aliases.map((a) => a.toLowerCase()));
  const lines: number[][] = [];
  for (const f of riverFeatures) {
    const names = [f.properties.name, f.properties.name_en].map((n) => String(n ?? "").toLowerCase());
    if (!names.some((n) => wanted.has(n))) continue;
    const parts = (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][];
    for (const part of parts) {
      const pts = simplify(part.map(([lon, lat]) => project(lon!, lat!)), 5);
      if (pts.length >= 2) lines.push(flat(pts));
    }
  }
  if (lines.length === 0) missing.push(display);
  else rivers.push({ name: display, lines });
}

// Mountains: famous peaks and ranges, as points (latitude, longitude) -----------------------------------------------------
type Mountain = { name: string; kind: "peak" | "range"; lat: number; lon: number; continent: string };
const MOUNTAINS: Mountain[] = [
  { name: "Mount Everest", kind: "peak", lat: 27.99, lon: 86.93, continent: "Asia" },
  { name: "K2", kind: "peak", lat: 35.88, lon: 76.51, continent: "Asia" },
  { name: "Mount Fuji", kind: "peak", lat: 35.36, lon: 138.73, continent: "Asia" },
  { name: "Mount Ararat", kind: "peak", lat: 39.7, lon: 44.3, continent: "Asia" },
  { name: "Kilimanjaro", kind: "peak", lat: -3.07, lon: 37.35, continent: "Africa" },
  { name: "Mount Kenya", kind: "peak", lat: -0.15, lon: 37.31, continent: "Africa" },
  { name: "Mont Blanc", kind: "peak", lat: 45.83, lon: 6.86, continent: "Europe" },
  { name: "Matterhorn", kind: "peak", lat: 45.98, lon: 7.66, continent: "Europe" },
  { name: "Mount Elbrus", kind: "peak", lat: 43.35, lon: 42.44, continent: "Europe" },
  { name: "Mount Etna", kind: "peak", lat: 37.75, lon: 15.0, continent: "Europe" },
  { name: "Mount Olympus", kind: "peak", lat: 40.09, lon: 22.36, continent: "Europe" },
  { name: "Ben Nevis", kind: "peak", lat: 56.8, lon: -5.0, continent: "Europe" },
  { name: "Denali", kind: "peak", lat: 63.07, lon: -151.0, continent: "North America" },
  { name: "Mount Whitney", kind: "peak", lat: 36.58, lon: -118.29, continent: "North America" },
  { name: "Pico de Orizaba", kind: "peak", lat: 19.03, lon: -97.27, continent: "North America" },
  { name: "Aconcagua", kind: "peak", lat: -32.65, lon: -70.01, continent: "South America" },
  { name: "Chimborazo", kind: "peak", lat: -1.47, lon: -78.82, continent: "South America" },
  { name: "Mount Kosciuszko", kind: "peak", lat: -36.46, lon: 148.26, continent: "Oceania" },
  { name: "Aoraki / Mount Cook", kind: "peak", lat: -43.59, lon: 170.14, continent: "Oceania" },
  { name: "The Alps", kind: "range", lat: 46.5, lon: 9.5, continent: "Europe" },
  { name: "The Pyrenees", kind: "range", lat: 42.7, lon: 0.5, continent: "Europe" },
  { name: "The Carpathians", kind: "range", lat: 47.0, lon: 24.5, continent: "Europe" },
  { name: "The Urals", kind: "range", lat: 60.0, lon: 60.0, continent: "Europe" },
  { name: "The Caucasus", kind: "range", lat: 42.8, lon: 44.5, continent: "Europe" },
  { name: "The Apennines", kind: "range", lat: 43.0, lon: 12.8, continent: "Europe" },
  { name: "The Scandinavian Mountains", kind: "range", lat: 62.0, lon: 9.0, continent: "Europe" },
  { name: "The Himalayas", kind: "range", lat: 29.0, lon: 84.0, continent: "Asia" },
  { name: "The Hindu Kush", kind: "range", lat: 35.5, lon: 70.5, continent: "Asia" },
  { name: "The Tian Shan", kind: "range", lat: 42.0, lon: 80.0, continent: "Asia" },
  { name: "The Atlas Mountains", kind: "range", lat: 32.0, lon: -5.0, continent: "Africa" },
  { name: "The Drakensberg", kind: "range", lat: -29.0, lon: 29.3, continent: "Africa" },
  { name: "The Ethiopian Highlands", kind: "range", lat: 10.0, lon: 38.5, continent: "Africa" },
  { name: "The Rocky Mountains", kind: "range", lat: 46.0, lon: -112.0, continent: "North America" },
  { name: "The Appalachians", kind: "range", lat: 37.5, lon: -80.5, continent: "North America" },
  { name: "The Sierra Madre", kind: "range", lat: 25.0, lon: -105.0, continent: "North America" },
  { name: "The Andes", kind: "range", lat: -15.0, lon: -71.0, continent: "South America" },
  { name: "The Great Dividing Range", kind: "range", lat: -33.0, lon: 150.0, continent: "Oceania" },
  { name: "The Southern Alps", kind: "range", lat: -43.5, lon: 170.5, continent: "Oceania" },
];
const mountains = MOUNTAINS.map((m) => ({ name: m.name, kind: m.kind, continent: m.continent, at: project(m.lon, m.lat) }));

// Output: one item per line, so the file is small and a diff is readable ---------------------------------------------------
const lines = (items: unknown[]) => items.map((i) => "  " + JSON.stringify(i)).join(",\n");
const out = `{"w":${W},"h":${H},\n"countries":[\n${lines(countries)}\n],\n"rivers":[\n${lines(rivers)}\n],\n"mountains":[\n${lines(mountains)}\n]}\n`;
writeFileSync(resolve(import.meta.dirname, "../../../content/games/map.json"), out);
console.log(`map.json: ${countries.length} countries, ${rivers.length} rivers, ${mountains.length} mountains, ${(out.length / 1024).toFixed(0)} KB`);
if (missing.length) console.log("Rivers not found in the data (dropped): " + missing.join(", "));
