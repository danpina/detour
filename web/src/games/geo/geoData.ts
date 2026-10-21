import raw from "../../../../content/games/geo.json";
import { CONTINENTS, type Country } from "./geoLogic";

type RawCountry = { name: string; capital: string; flag: string; continent: string; level: number; note?: string };

/** The bundled country list (content/games/geo.json). Rows with an unknown continent or level are skipped. */
export const COUNTRIES: Country[] = (raw as { countries: RawCountry[] }).countries.filter(
  (c) => (CONTINENTS as readonly string[]).includes(c.continent) && (c.level === 1 || c.level === 2 || c.level === 3),
) as Country[];
