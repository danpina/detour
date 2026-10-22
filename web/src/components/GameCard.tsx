import { GAMES } from "../games/registry";
import type { GameId } from "../games/ids";

/** A short game played inside a set of cards. It plays a few puzzles, then hands control back to the set. */
export function GameCard({ game, onDone, onSkip }: { game: GameId; onDone: () => void; onSkip: () => void }) {
  const def = GAMES.find((g) => g.id === game);
  if (!def) return null;
  const Game = def.Component;
  return (
    <div className="absolute inset-0 z-10 bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <Game onExit={onSkip} embedded={{ onDone: () => onDone() }} />
    </div>
  );
}
