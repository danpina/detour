import type { GameProps } from "../registry";

/** Placeholder until the game is built. */
export function GeoGame({ onExit }: GameProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="text-2xl font-semibold">Geography</h1>
      <p className="text-neutral-500 dark:text-neutral-400">Coming soon.</p>
      <button onClick={onExit} className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white">Back</button>
    </div>
  );
}
