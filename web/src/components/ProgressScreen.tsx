import { useEffect, useState } from "react";
import { INTERESTS } from "@detour/content";
import { INTEREST_INFO } from "../lib/content";
import { LONG_TERM_DAYS, type CardState } from "../lib/progress";
import { saveRecapImage } from "../lib/recapImage";
import { markRecapSeen } from "../lib/home";
import { loadProgress } from "../lib/session";
import { GamesProgress } from "./GamesProgress";

type Section = "learning" | "math" | "games";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "learning", label: "📚 Learning" },
  { id: "math", label: "🔢 Math" },
  { id: "games", label: "🎮 Games" },
];

type Data = Awaited<ReturnType<typeof loadProgress>>;

const DOT: Record<CardState, string> = {
  new: "border border-neutral-300 dark:border-neutral-700",
  seen: "bg-teal-200 dark:bg-teal-900",
  learning: "bg-teal-400 dark:bg-teal-600",
  solid: "bg-teal-600 dark:bg-teal-300",
};

const card = "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";

export function ProgressScreen({ onOpenLearned }: { onOpenLearned: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [saved, setSaved] = useState("");
  const [section, setSection] = useState<Section>("learning");

  useEffect(() => {
    void loadProgress().then(setData);
    markRecapSeen();
  }, []);

  if (!data) return <div className="flex h-full items-center justify-center text-neutral-500">Loading…</div>;
  const { streak, recall, map, skills, recap } = data;

  return (
    <div className="h-full overflow-auto px-5 pb-28 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <h1 className="text-3xl font-semibold tracking-tight">Your progress</h1>

      <section className={`${card} mt-5`}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">🔥</span>
          <div>
            <div className="text-2xl font-semibold">{streak.current} {streak.current === 1 ? "day" : "days"}</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Best: {streak.best} · {streak.freezesLeft} {streak.freezesLeft === 1 ? "freeze" : "freezes"} left this week</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">A freeze covers a day you miss, so one off day won't break your streak.</p>
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Progress section">
        {SECTIONS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={section === x.id}
            onClick={() => setSection(x.id)}
            className={`min-h-11 rounded-xl border px-2 py-2 text-sm font-medium ${section === x.id ? "border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-100" : "border-neutral-300 dark:border-neutral-700"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {section === "learning" && (
        <>
      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Remembered</h2>
        {recall.rate === null ? (
          <p className="mt-2">Your first recall check unlocks tomorrow. Come back and we'll see what stuck.</p>
        ) : (
          <>
            <div className="mt-1 text-4xl font-semibold">{Math.round(recall.rate * 100)}%</div>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              You recalled {Math.round(recall.rate * 100)}% of what you learned this month ({recall.correct} of {recall.total} checks).
            </p>
          </>
        )}
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Knowledge map</h2>
        <div className="mt-3 space-y-4">
          {INTERESTS.filter((i) => i !== "estimation").map((i) => {
            const cards = map.get(i) ?? [];
            const solid = cards.filter((c) => c.state === "solid").length;
            return (
              <div key={i}>
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{INTEREST_INFO[i].emoji} {INTEREST_INFO[i].name}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{cards.length ? `${solid} of ${cards.length} locked in` : "More coming soon"}</span>
                </div>
                {cards.length > 0 && (
                  <div
                    role="img"
                    aria-label={`${cards.length} cards: ${(["solid", "learning", "seen", "new"] as CardState[]).map((st) => `${cards.filter((c) => c.state === st).length} ${{ new: "not yet", seen: "seen", learning: "sticking", solid: "locked in" }[st]}`).join(", ")}`}
                    className="mt-2 flex flex-wrap gap-1.5"
                  >
                    {cards.map((c) => (
                      <span key={c.id} title={`${c.id}: ${c.state}`} className={`h-4 w-4 rounded ${DOT[c.state]}`} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          {(["new", "seen", "learning", "solid"] as CardState[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded ${DOT[s]}`} />
              {{ new: "Not yet", seen: "Seen", learning: "Sticking", solid: `Locked in (${LONG_TERM_DAYS}+ days)` }[s]}
            </span>
          ))}
        </div>
      </section>

      <button onClick={onOpenLearned} className={`${card} mt-4 flex w-full items-center justify-between text-left font-medium`}>
        <span>Browse what you've learned</span>
        <span aria-hidden="true" className="text-neutral-400">›</span>
      </button>

      <section className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-slate-900 to-black p-5 text-white">
        <h2 className="text-sm font-medium text-teal-200">Your week</h2>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Stat big={String(recap.cards)} small="cards" />
          <Stat big={recap.recallRate === null ? "–" : `${Math.round(recap.recallRate * 100)}%`} small="recalled" />
          <Stat big={recap.minutes < 1 ? "<1" : String(recap.minutes)} small="minutes learning" />
          <Stat big={String(recap.streak)} small="day streak" />
        </div>
        <button
          onClick={async () => setSaved((await saveRecapImage(recap)) === "shared" ? "Shared" : "Saved to your downloads")}
          className="mt-5 w-full rounded-2xl bg-white py-3 font-semibold text-neutral-900 active:scale-[0.98]"
        >
          Save as image
        </button>
        {saved && <p className="mt-2 text-center text-xs text-white/70">{saved}</p>}
      </section>
        </>
      )}

      {section === "math" && (
        <>
      <section className={`${card} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Your math levels</h2>
        <div className="mt-3 space-y-4">
          {skills.map((s) => (
            <div key={s.id}>
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{s.name}</span>
                <span className="text-sm">Level {s.level}<span className="text-neutral-500"> / {s.maxLevel}</span></span>
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">{s.levelName} · {s.attempts} {s.attempts === 1 ? "problem" : "problems"} answered</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, (s.recentTotal / 20) * 100)}%` }} />
              </div>
              <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {s.recentTotal ? `${s.recentRight} of ${s.recentTotal} recent answers right (level up at 80% over 20)` : "Practise in a Math round"}
              </div>
            </div>
          ))}
        </div>
      </section>

        </>
      )}

      {section === "games" && <GamesProgress />}
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold tabular-nums">{big}</div>
      <div className="text-xs text-white/70">{small}</div>
    </div>
  );
}
