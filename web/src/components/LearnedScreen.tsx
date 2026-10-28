import { useEffect, useMemo, useState } from "react";
import { INTERESTS, type Interest } from "@detour/content";
import { ALL_CARDS, INTEREST_INFO, imageUrl } from "../lib/content";
import { store } from "../lib/db";
import { STATE_LABEL, cardParagraphs, filterLearned, learnedAgo, learnedCards, type LearnedRow } from "../lib/learned";
import { Sheet } from "./Sheet";

/** Everything you've learned, to search and read again. Reading here records nothing: no progress, no reviews. */
export function LearnedScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<LearnedRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Interest | "all">("all");
  const [open, setOpen] = useState<LearnedRow | null>(null);
  const now = useMemo(() => Date.now(), []);

  useEffect(() => {
    void Promise.all([store.getEvents(), store.getReviews()]).then(([events, reviews]) => setRows(learnedCards(ALL_CARDS, events, reviews)));
  }, []);

  const topics = INTERESTS.filter((i) => i !== "games" && i !== "estimation");
  const shown = rows ? filterLearned(rows, query, topic) : [];
  const chip = (active: boolean) =>
    `min-h-11 shrink-0 rounded-full border px-3 text-sm ${active ? "border-teal-600 bg-teal-50 font-medium text-teal-900 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-100" : "border-neutral-300 dark:border-neutral-700"}`;
  const image = open && "image" in open.card ? open.card.image : undefined;

  return (
    <div className="flex h-full flex-col px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button onClick={onBack} className="min-h-11 self-start text-left text-neutral-500 dark:text-neutral-400">← Progress</button>
      <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight">What you've learned</h1>

      {rows === null ? (
        <p className="mt-6 text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-neutral-500 dark:text-neutral-400">Nothing here yet. Every card you finish lands here, so you can read it again.</p>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="sr-only">Search what you've learned</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your cards"
              className="min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-4 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Topic">
            <button aria-pressed={topic === "all"} onClick={() => setTopic("all")} className={chip(topic === "all")}>All</button>
            {topics.map((i) => (
              <button key={i} aria-pressed={topic === i} onClick={() => setTopic(i)} className={chip(topic === i)}>
                {INTEREST_INFO[i].emoji} {INTEREST_INFO[i].name}
              </button>
            ))}
          </div>

          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">
            {shown.length} {shown.length === 1 ? "card" : "cards"}
          </p>
          <ul className="mt-2 flex-1 space-y-2 overflow-auto pb-4">
            {shown.map((r) => (
              <li key={r.card.id}>
                <button
                  onClick={() => setOpen(r)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <span aria-hidden="true" className="text-2xl">{INTEREST_INFO[r.card.interest].emoji}</span>
                  <span className="flex-1">
                    <span className="block font-semibold leading-snug">{r.card.title}</span>
                    <span className="block text-sm text-neutral-500 dark:text-neutral-400">
                      {INTEREST_INFO[r.card.interest].name} · {STATE_LABEL[r.state]} · learned {learnedAgo(r.learnedAt, now)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="text-neutral-500 dark:text-neutral-400">No card matches. Try fewer words.</li>}
          </ul>
        </>
      )}

      {open && (
        <Sheet title={open.card.title} onClose={() => setOpen(null)}>
          {image && imageUrl(image.file) && <img src={imageUrl(image.file)} alt={image.alt} className="mb-3 max-h-56 w-full rounded-xl object-cover" />}
          <div className="space-y-3 leading-relaxed">
            {cardParagraphs(open.card).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <h3 className="mt-5 text-sm font-medium text-neutral-500 dark:text-neutral-400">Where this comes from</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {open.card.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-teal-700 underline dark:text-teal-300">{s.title}</a>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
