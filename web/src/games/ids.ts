/** The games, by id. Kept free of components so the engine can use it without loading any game. */
export const GAME_IDS = ["chess", "patterns", "words", "geo", "memory", "languages", "logic", "map"] as const;
export type GameId = (typeof GAME_IDS)[number];

/** A random game for a set of cards. */
export function randomGameId(): GameId {
  return GAME_IDS[Math.floor(Math.random() * GAME_IDS.length)]!;
}
