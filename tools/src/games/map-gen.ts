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
      pop: Math.round(Number(p.POP_EST)),
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
  { name: "Kangchenjunga", kind: "peak", lat: 27.7, lon: 88.15, continent: "Asia" },
  { name: "Annapurna", kind: "peak", lat: 28.6, lon: 83.82, continent: "Asia" },
  { name: "Mount Kailash", kind: "peak", lat: 31.07, lon: 81.31, continent: "Asia" },
  { name: "Mount Damavand", kind: "peak", lat: 35.95, lon: 52.11, continent: "Asia" },
  { name: "Mount Kinabalu", kind: "peak", lat: 6.08, lon: 116.56, continent: "Asia" },
  { name: "Mount Sinai", kind: "peak", lat: 28.54, lon: 33.97, continent: "Asia" },
  { name: "Table Mountain", kind: "peak", lat: -33.96, lon: 18.4, continent: "Africa" },
  { name: "Mount Cameroon", kind: "peak", lat: 4.2, lon: 9.17, continent: "Africa" },
  { name: "Ras Dashen", kind: "peak", lat: 13.24, lon: 38.4, continent: "Africa" },
  { name: "Mount Teide", kind: "peak", lat: 28.27, lon: -16.64, continent: "Africa" },
  { name: "Zugspitze", kind: "peak", lat: 47.42, lon: 10.98, continent: "Europe" },
  { name: "Grossglockner", kind: "peak", lat: 47.07, lon: 12.69, continent: "Europe" },
  { name: "Mount Vesuvius", kind: "peak", lat: 40.82, lon: 14.43, continent: "Europe" },
  { name: "Mulhacén", kind: "peak", lat: 37.05, lon: -3.31, continent: "Europe" },
  { name: "Mount Rainier", kind: "peak", lat: 46.85, lon: -121.76, continent: "North America" },
  { name: "Mount Logan", kind: "peak", lat: 60.57, lon: -140.4, continent: "North America" },
  { name: "Popocatépetl", kind: "peak", lat: 19.02, lon: -98.62, continent: "North America" },
  { name: "Cotopaxi", kind: "peak", lat: -0.68, lon: -78.44, continent: "South America" },
  { name: "Huascarán", kind: "peak", lat: -9.12, lon: -77.6, continent: "South America" },
  { name: "Mount Taranaki", kind: "peak", lat: -39.3, lon: 174.06, continent: "Oceania" },
  { name: "Mauna Kea", kind: "peak", lat: 19.82, lon: -155.47, continent: "Oceania" },
];

/** Mountain ranges, drawn and judged along their spine (latitude, longitude points) rather than as one dot. */
type Range = { name: string; continent: string; spine: [number, number][] };
const RANGES: Range[] = [
  { name: "The Alps", continent: "Europe", spine: [[43.7, 7.2], [44.5, 7.0], [45.5, 6.8], [46.0, 7.5], [46.5, 8.6], [46.8, 9.8], [47.0, 11.0], [47.3, 12.5], [47.5, 13.8], [47.6, 15.5]] },
  { name: "The Pyrenees", continent: "Europe", spine: [[43.3, -1.8], [42.9, -0.5], [42.7, 0.7], [42.6, 1.7], [42.5, 2.6], [42.4, 3.2]] },
  { name: "The Carpathians", continent: "Europe", spine: [[49.4, 19.0], [49.0, 20.5], [48.6, 22.5], [48.0, 24.2], [47.5, 25.2], [46.5, 25.6], [45.7, 25.5], [45.4, 24.5], [45.2, 23.0], [44.7, 22.2]] },
  { name: "The Urals", continent: "Europe", spine: [[67.5, 66.5], [65.0, 60.5], [62.0, 59.5], [59.0, 59.0], [56.0, 59.5], [53.5, 58.5], [51.0, 58.5]] },
  { name: "The Caucasus", continent: "Europe", spine: [[44.0, 38.5], [43.5, 40.5], [43.2, 42.5], [42.8, 44.5], [42.3, 46.5], [41.8, 47.8], [41.0, 48.8]] },
  { name: "The Apennines", continent: "Europe", spine: [[44.3, 8.9], [44.0, 10.5], [43.5, 12.2], [42.5, 13.3], [41.5, 14.5], [40.3, 15.7], [39.2, 16.4], [38.2, 15.9]] },
  { name: "The Scandinavian Mountains", continent: "Europe", spine: [[69.5, 20.5], [68.0, 17.5], [66.0, 14.5], [64.0, 12.5], [62.0, 9.5], [60.5, 8.0], [59.5, 7.0]] },
  { name: "The Balkan Mountains", continent: "Europe", spine: [[43.3, 22.5], [43.0, 25.0], [42.8, 27.0]] },
  { name: "The Himalayas", continent: "Asia", spine: [[34.5, 73.0], [33.0, 76.0], [31.0, 78.5], [29.5, 81.5], [28.3, 84.5], [27.8, 88.0], [27.5, 91.0], [28.2, 94.5], [29.0, 97.0]] },
  { name: "The Karakoram", continent: "Asia", spine: [[36.5, 74.5], [36.0, 76.5], [35.5, 77.5]] },
  { name: "The Hindu Kush", continent: "Asia", spine: [[37.0, 71.5], [36.0, 70.5], [35.3, 69.5], [34.6, 68.0], [34.2, 66.5]] },
  { name: "The Tian Shan", continent: "Asia", spine: [[42.5, 71.0], [42.2, 75.0], [42.0, 78.5], [42.7, 82.0], [43.3, 85.5], [43.5, 88.5]] },
  { name: "The Altai", continent: "Asia", spine: [[51.0, 85.0], [49.5, 88.0], [48.5, 90.5], [47.5, 93.0]] },
  { name: "The Zagros", continent: "Asia", spine: [[37.5, 44.5], [35.5, 46.5], [33.5, 48.5], [31.5, 50.5], [29.5, 52.5], [27.5, 55.5]] },
  { name: "The Western Ghats", continent: "Asia", spine: [[21.0, 73.5], [17.0, 73.8], [13.0, 75.2], [9.5, 77.0], [8.2, 77.3]] },
  { name: "The Atlas Mountains", continent: "Africa", spine: [[31.2, -9.5], [31.8, -7.0], [32.2, -5.0], [33.0, -3.0], [34.2, -1.5], [35.4, 1.0], [36.1, 4.0], [35.9, 7.0], [35.7, 9.5]] },
  { name: "The Drakensberg", continent: "Africa", spine: [[-27.0, 29.2], [-28.5, 29.0], [-29.5, 29.2], [-30.5, 28.2], [-31.3, 27.5], [-32.5, 27.0]] },
  { name: "The Ethiopian Highlands", continent: "Africa", spine: [[14.0, 38.0], [12.0, 38.2], [10.0, 38.5], [8.0, 38.5], [7.0, 37.5]] },
  { name: "The Rocky Mountains", continent: "North America", spine: [[59.5, -125.0], [56.0, -122.5], [52.5, -118.5], [49.5, -114.5], [46.5, -112.5], [43.5, -110.5], [40.5, -106.5], [37.5, -105.5], [35.5, -106.0]] },
  { name: "The Appalachians", continent: "North America", spine: [[45.5, -70.0], [44.0, -71.5], [42.5, -73.0], [40.5, -76.5], [38.5, -79.0], [36.0, -81.5], [34.5, -84.0]] },
  { name: "The Sierra Nevada", continent: "North America", spine: [[40.0, -121.0], [38.0, -119.5], [36.0, -118.3], [35.4, -118.0]] },
  { name: "The Cascades", continent: "North America", spine: [[49.0, -121.5], [46.5, -121.7], [44.0, -121.8], [41.5, -122.2]] },
  { name: "The Sierra Madre", continent: "North America", spine: [[30.0, -109.0], [28.0, -108.0], [26.0, -106.5], [24.0, -105.0], [22.0, -104.0], [20.5, -103.5]] },
  { name: "The Andes", continent: "South America", spine: [[10.5, -72.5], [7.0, -73.5], [4.0, -75.5], [0.0, -77.8], [-3.5, -79.0], [-8.0, -77.5], [-12.0, -75.5], [-15.5, -72.0], [-18.0, -69.5], [-22.0, -68.0], [-27.0, -68.5], [-32.5, -70.0], [-37.0, -71.2], [-42.0, -72.0], [-48.0, -73.0], [-53.0, -72.0]] },
  { name: "The Great Dividing Range", continent: "Oceania", spine: [[-15.0, 145.0], [-19.0, 146.5], [-23.5, 149.0], [-27.0, 152.0], [-30.5, 151.8], [-34.0, 150.5], [-37.0, 148.5], [-37.8, 145.5]] },
  { name: "The Southern Alps", continent: "Oceania", spine: [[-41.0, 172.5], [-42.5, 171.5], [-43.5, 170.5], [-44.5, 169.2], [-45.5, 168.0]] },
];

const peaks = MOUNTAINS.map((m) => ({ name: m.name, kind: m.kind, continent: m.continent, at: project(m.lon, m.lat) }));
const ranges = RANGES.map((r) => {
  const pts = r.spine.map(([lat, lon]) => project(lon, lat));
  const mid = pts[Math.floor(pts.length / 2)]!;
  return { name: r.name, kind: "range" as const, continent: r.continent, at: mid, line: flat(pts) };
});
const mountains = [...peaks, ...ranges];

// Output: one item per line, so the file is small and a diff is readable ---------------------------------------------------
const lines = (items: unknown[]) => items.map((i) => "  " + JSON.stringify(i)).join(",\n");
const out = `{"w":${W},"h":${H},\n"countries":[\n${lines(countries)}\n],\n"rivers":[\n${lines(rivers)}\n],\n"mountains":[\n${lines(mountains)}\n]}\n`;
writeFileSync(resolve(import.meta.dirname, "../../../content/games/map.json"), out);
console.log(`map.json: ${countries.length} countries, ${rivers.length} rivers, ${mountains.length} mountains, ${(out.length / 1024).toFixed(0)} KB`);
if (missing.length) console.log("Rivers not found in the data (dropped): " + missing.join(", "));
