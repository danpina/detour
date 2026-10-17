type Props = { learned: number; onAnother: () => void; onInterests: () => void };

export function EndScreen({ learned, onAnother, onInterests }: Props) {
  return (
    <div className="flex h-full flex-col justify-center px-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center">
      <div className="text-5xl">✨</div>
      <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">
        You learned {learned || 5} things.
      </h1>
      <p className="mt-3 text-lg text-neutral-500 dark:text-neutral-400">We'll check tomorrow if they stuck.</p>

      <div className="mt-10 space-y-3">
        <button onClick={onAnother} className="w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white active:scale-[0.98]">
          Another quick one
        </button>
        <button onClick={onInterests} className="w-full rounded-2xl py-3 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900">
          Change my interests
        </button>
      </div>
    </div>
  );
}
