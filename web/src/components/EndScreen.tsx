type Props = { learned: number; practice?: boolean; onAnother: () => void; onProgress: () => void; onDone: () => void };

export function EndScreen({ learned, practice = false, onAnother, onProgress, onDone }: Props) {
  return (
    <div className="flex h-full flex-col justify-center px-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <div className="text-5xl">✨</div>
      <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">
        {practice ? "Nice practice." : `You learned ${learned || 5} things.`}
      </h1>
      <p className="mt-3 text-lg text-neutral-500 dark:text-neutral-400">{practice ? "Your level moves up as you get more right." : "We'll check tomorrow if they stuck."}</p>

      <div className="mt-10 space-y-3">
        <button onClick={onAnother} className="w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white active:scale-[0.98]">
          {practice ? "Another round" : "Another quick one"}
        </button>
        <button onClick={onDone} className="w-full rounded-2xl py-3 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900">
          Done for now
        </button>
        <button onClick={onProgress} className="w-full rounded-2xl py-3 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900">
          See my progress
        </button>
      </div>
    </div>
  );
}
