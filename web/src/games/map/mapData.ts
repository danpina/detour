import type { MapData } from "./mapLogic";

let cached: MapData | null = null;

/** The bundled map (content/games/map.json). Loaded when the game opens, so the map stays out of the first download. */
export async function loadMap(): Promise<MapData> {
  if (!cached) cached = ((await import("../../../../content/games/map.json")).default as unknown) as MapData;
  return cached;
}
