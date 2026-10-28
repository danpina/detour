import type { RoundKind } from "../lib/session";

type Props = { learned: number; round?: RoundKind; onAnother: () => void; onProgress: () => void; onDone?: () => void };

const COPY: Record<RoundKind, { emoji: string; title: (n: number) => string; line: string; another: string }> = {
  learning: { emoji: "✨", title: (n) => `You learned ${n || 5} things.`, line: "We\u0027ll check tomorrow if they stuck.", another: "Pick another round" },
  math: { emoji: "🔢", title: () => "Math round done.", line: "Little and often is how numbers get easy.", another: "Pick another round" },
  games: { emoji: "🎮", title: () => "That was fun.", line: "A good break, and a bit of practice on the side.", another: "Pick another round" },
};

export function EndScreen({ learned, round = "learning", onAnother, onProgress }: Props) {
  const copy = COPY[round];
  return (
    <div className="flex h-full flex-col justify-center px-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <div aria-hidden="true" className="text-5xl">{copy.emoji}</div>
      <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">
        {copy.title(learned)}
      </h1>
      <p className="mt-3 text-lg text-neutral-500 dark:text-neutral-400">{copy.line}</p>

      <div className="mt-10 space-y-3">
        <button onClick={onAnother} className="w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white active:scale-[0.98]">
          {copy.another}
        </button>
        <button onClick={onProgress} className="w-full rounded-2xl py-3 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900">
          See my progress
        </button>
      </div>
    </div>
  );
}
