import { useEffect, useState } from "react";
import { ALL_CARDS } from "../lib/content";
import { loadHomeInfo, type HomeInfo } from "../lib/home";
import type { RoundKind } from "../lib/session";
import { isReviewer, seenInReview } from "../lib/reviewer";
import { canPromptInstall, dismissInstall, installDismissed, installHint, isInstalled, isIos, promptInstall, type InstallHint } from "../lib/install";

type Props = { onStart: (round: RoundKind) => void; onOpenSettings: () => void; onOpenProgress: () => void; onReview: () => void };

const ROUNDS: { kind: RoundKind; emoji: string; title: string; blurb: (info: HomeInfo | null) => string }[] = [
  { kind: "learning", emoji: "📚", title: "Learning round", blurb: (i) => {
    const n = i?.roundSize ?? 5;
    return i && i.dueCount > 0 ? `${n} small cards. ${i.dueCount} to check if they stuck.` : `${n} small cards to learn something new.`;
  } },
  { kind: "math", emoji: "🔢", title: "Math round", blurb: (i) => `${i?.roundSize ?? 5} quick problems · level ${i?.mathLevel ?? 1}` },
  { kind: "games", emoji: "🎮", title: "Game round", blurb: (i) => `${i?.roundSize ?? 5} quick games: language, map, chess and more.` },
];

export function HomeScreen({ onStart, onOpenSettings, onOpenProgress, onReview }: Props) {
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

  const toReview = isReviewer() ? ALL_CARDS.filter((c) => c.review?.by === "agent" && !seenInReview().has(c.id)).length : 0;
  const card = "mt-4 rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-left text-sm dark:border-neutral-700";

  return (
    <div className="flex h-full flex-col justify-center overflow-auto px-8 pb-20 pt-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Quick one?</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">Pick a round. About a minute.</p>

      <div className="mt-7 space-y-3 text-left">
        {ROUNDS.map((r) => (
          <button
            key={r.kind}
            onClick={() => onStart(r.kind)}
            className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900"
          >
            <span className="text-3xl">{r.emoji}</span>
            <span className="flex-1">
              <span className="block text-lg font-semibold">{r.title}</span>
              <span className="block text-sm text-neutral-500 dark:text-neutral-400">{r.blurb(info)}</span>
            </span>
          </button>
        ))}
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
