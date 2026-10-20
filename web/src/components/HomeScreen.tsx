import { useEffect, useState } from "react";
import { ALL_CARDS } from "../lib/content";
import { TRACKS, TRACK_IDS, type TrackId } from "../lib/drills";
import { loadHomeInfo, type HomeInfo } from "../lib/home";
import { isReviewer, seenInReview } from "../lib/reviewer";
import { canPromptInstall, dismissInstall, installDismissed, installHint, isInstalled, isIos, promptInstall, type InstallHint } from "../lib/install";

type Props = { onStart: (feed: boolean) => void; onPractice: (track: TrackId) => void; onOpenSettings: () => void; onOpenProgress: () => void; onReview: () => void };

export function HomeScreen({ onStart, onPractice, onOpenSettings, onOpenProgress, onReview }: Props) {
  const [info, setInfo] = useState<HomeInfo | null>(null);
  const [hint, setHint] = useState<InstallHint>(null);

  useEffect(() => {
    void loadHomeInfo().then(setInfo);
  }, []);

  useEffect(() => {
    if (!info) return;
    const compute = () =>
      setHint(installHint({ installed: isInstalled(), dismissed: installDismissed(), sessions: info.sessions, canPrompt: canPromptInstall(), ios: isIos() }));
    compute();
    window.addEventListener("detour:install-available", compute);
    return () => window.removeEventListener("detour:install-available", compute);
  }, [info]);

  const due = info?.dueCount ?? 0;
  const toReview = isReviewer() ? ALL_CARDS.filter((c) => c.review?.by === "agent" && !seenInReview().has(c.id)).length : 0;
  const card = "mt-4 rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-left text-sm dark:border-neutral-700";

  return (
    <div className="flex h-full flex-col justify-center overflow-auto px-8 pb-20 pt-8 text-center">
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

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Practice</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TRACK_IDS.map((t) => (
            <button key={t} onClick={() => onPractice(t)} className="rounded-2xl border border-neutral-300 py-3 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
              {TRACKS[t].name}
            </button>
          ))}
        </div>
      </div>

      {isReviewer() && (
        <button onClick={onReview} disabled={toReview === 0} className="mt-5 rounded-2xl border-2 border-rose-500 px-4 py-3 text-sm font-medium text-rose-700 disabled:opacity-50 dark:text-rose-300">
          Review mode: {toReview === 0 ? "all agent-approved cards seen" : `${toReview} agent-approved ${toReview === 1 ? "card" : "cards"} to look at`}
        </button>
      )}

      {info?.weekRecap && (
        <button onClick={onOpenProgress} className={`${card} text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900`}>
          Your week is ready: {info.weekRecap.cards} {info.weekRecap.cards === 1 ? "card" : "cards"}. See your recap
        </button>
      )}

      {hint && (
        <div className={`${card} text-neutral-600 dark:text-neutral-300`}>
          {hint === "prompt" ? (
            <>
              <p>Install Detour for one-tap access and to keep your progress safe.</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={async () => {
                    await promptInstall();
                    setHint(null);
                  }}
                  className="rounded-xl bg-teal-600 px-4 py-2 font-medium text-white"
                >
                  Install
                </button>
                <button
                  onClick={() => {
                    dismissInstall();
                    setHint(null);
                  }}
                  className="rounded-xl px-4 py-2 text-neutral-500"
                >
                  Not now
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Add Detour to your Home Screen: tap the Share button, then "Add to Home Screen". It keeps your progress safe too.</p>
              <button
                onClick={() => {
                  dismissInstall();
                  setHint(null);
                }}
                className="mt-3 rounded-xl px-4 py-2 text-neutral-500"
              >
                Got it
              </button>
            </>
          )}
        </div>
      )}

      {info?.backupNudge && (
        <button onClick={onOpenSettings} className={`${card} text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900`}>
          Your progress lives on this device. Save a backup?
        </button>
      )}
    </div>
  );
}
