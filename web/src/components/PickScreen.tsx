import { useEffect, useState } from "react";
import { INTERESTS, type Interest } from "@detour/content";
import { ALL_CARDS, INTEREST_INFO } from "../lib/content";
import { store } from "../lib/db";
import { TRACKS, TRACK_IDS, type SkillProgress, type TrackId } from "../lib/drills";
import { dueReviews } from "../lib/engine";

type Props = {
  onBack: () => void;
  onStartTopic: (topic: Interest) => void;
  onStartDue: () => void;
  onStartSkill: (track: TrackId) => void;
  onOpenGames: () => void;
  onOpenSkills: () => void;
};

type Tab = "cards" | "math";

/** "Pick something specific": a round of one topic's cards, only the cards due for review, or one math skill. */
export function PickScreen({ onBack, onStartTopic, onStartDue, onStartSkill, onOpenGames, onOpenSkills }: Props) {
  const [tab, setTab] = useState<Tab>("cards");
  const [due, setDue] = useState<Map<Interest, number>>(new Map());
  const [skills, setSkills] = useState<SkillProgress[]>([]);
  const [off, setOff] = useState<string[]>([]);

  useEffect(() => {
    void store.getReviews().then((reviews) => {
      const counts = new Map<Interest, number>();
      for (const r of dueReviews(ALL_CARDS, reviews, Date.now())) counts.set(r.card.interest, (counts.get(r.card.interest) ?? 0) + 1);
      setDue(counts);
    });
    void store.getSkills().then(setSkills);
    void store.getSettings().then((s) => setOff(s?.math_off ?? []));
  }, []);

  const topics = INTERESTS.filter((i) => i !== "games" && i !== "estimation");
  const dueTotal = [...due.values()].reduce((a, b) => a + b, 0);
  const onSkills = TRACK_IDS.filter((id) => !off.includes(id));
  const row = "flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900";
  const start = <span className="text-sm font-medium text-teal-700 dark:text-teal-300">Start ›</span>;

  const seg = (id: Tab | "games", label: string, onClick: () => void) => (
    <button
      key={id}
      role="tab"
      aria-selected={tab === id}
      onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-sm ${tab === id ? "border border-neutral-200 bg-white font-semibold dark:border-neutral-700 dark:bg-neutral-800" : "text-neutral-500 dark:text-neutral-400"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button onClick={onBack} className="min-h-11 self-start text-left text-neutral-500 dark:text-neutral-400">← Home</button>
      <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight">Pick something specific</h1>

      <div role="tablist" className="mt-4 flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
        {seg("cards", "Cards", () => setTab("cards"))}
        {seg("math", "Math", () => setTab("math"))}
        {seg("games", "Games", onOpenGames)}
      </div>

      <div className="mt-4 grid flex-1 content-start gap-2 overflow-auto pb-4">
        {tab === "cards" ? (
          <>
            {topics.map((i) => {
              const cards = ALL_CARDS.filter((c) => c.interest === i && c.type !== "drill" && c.type !== "recall").length;
              const d = due.get(i) ?? 0;
              return (
                <button key={i} onClick={() => onStartTopic(i)} className={row}>
                  <span aria-hidden="true" className="text-2xl">{INTEREST_INFO[i].emoji}</span>
                  <span className="flex-1">
                    <span className="block font-semibold">{INTEREST_INFO[i].name}</span>
                    <span className="block text-sm text-neutral-500 dark:text-neutral-400">{cards} cards{d > 0 ? ` · ${d} to review` : ""}</span>
                  </span>
                  {start}
                </button>
              );
            })}
            <button onClick={onStartDue} disabled={dueTotal === 0} className={`${row} mt-2 disabled:opacity-60`}>
              <span aria-hidden="true" className="text-2xl">🔁</span>
              <span className="flex-1">
                <span className="block font-semibold">Check what stuck</span>
                <span className="block text-sm text-neutral-500 dark:text-neutral-400">{dueTotal > 0 ? `Only cards due for review (${dueTotal})` : "Nothing due right now"}</span>
              </span>
              {dueTotal > 0 && start}
            </button>
          </>
        ) : (
          <>
            {onSkills.map((id) => {
              const s = skills.find((x) => x.track_id === id);
              return (
                <button key={id} onClick={() => onStartSkill(id)} className={row}>
                  <span className="flex-1">
                    <span className="block font-semibold">{TRACKS[id].name}</span>
                    <span className="block text-sm text-neutral-500 dark:text-neutral-400">{s && s.attempts_total > 0 ? `Level ${s.level} of ${TRACKS[id].maxLevel}` : "Not started"}</span>
                  </span>
                  {start}
                </button>
              );
            })}
            <button onClick={onOpenSkills} className={`${row} mt-2`}>
              <span className="flex-1">
                <span className="block font-semibold">Choose your skills</span>
                <span className="block text-sm text-neutral-500 dark:text-neutral-400">{onSkills.length} of {TRACK_IDS.length} on in your rounds</span>
              </span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Edit ›</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
