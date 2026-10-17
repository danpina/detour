import { useEffect, useState } from "react";
import { loadHomeInfo, type HomeInfo } from "../lib/home";

type Props = { onStart: (feed: boolean) => void; onOpenSettings: () => void };

export function HomeScreen({ onStart, onOpenSettings }: Props) {
  const [info, setInfo] = useState<HomeInfo | null>(null);

  useEffect(() => {
    void loadHomeInfo().then(setInfo);
  }, []);

  const due = info?.dueCount ?? 0;

  return (
    <div className="flex h-full flex-col justify-center px-8 pb-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Quick one?</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">Five small cards, about a minute.</p>

      {due > 0 && (
        <p className="mt-5 rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:bg-teal-950 dark:text-teal-100">
          {due === 1 ? "1 thing is ready" : `${due} things are ready`} to check if it stuck.
        </p>
      )}

      <button onClick={() => onStart(false)} className="mt-8 w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white active:scale-[0.98]">
        Let's go
      </button>
      <button onClick={() => onStart(true)} className="mt-3 w-full rounded-2xl border border-neutral-300 py-3.5 font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
        Keep scrolling
      </button>

      {info?.backupNudge && (
        <button
          onClick={onOpenSettings}
          className="mt-6 rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
        >
          Your progress lives on this device. Save a backup?
        </button>
      )}
    </div>
  );
}
