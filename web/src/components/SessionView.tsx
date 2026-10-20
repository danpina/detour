import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "../analytics";
import { store } from "../lib/db";
import type { SessionItem } from "../lib/engine";
import { markSeenInReview } from "../lib/reviewer";
import { recordActivity, recordCompletion } from "../lib/session";
import { DrillView } from "./DrillView";
import { EstimateCard } from "./cards/EstimateCard";
import { FactWhyCard } from "./cards/FactWhyCard";
import { GuessFirstCard } from "./cards/GuessFirstCard";
import { RecallCard } from "./cards/RecallCard";
import { StoryCard } from "./cards/StoryCard";
import type { CardResult } from "./cards/types";

type Props = {
  items: SessionItem[];
  source: "free";
  /** Called after the last card. */
  onFinish: (completed: number) => void;
  /** Free-scroll feed: show a way out. */
  onExit?: () => void;
  /** Reviewer mode: look at cards without recording progress, events or analytics. */
  dryRun?: boolean;
};

export function SessionView({ items, source, onFinish, onExit, dryRun = false }: Props) {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const shownAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const completedRef = useRef(completed);
  completedRef.current = completed;
  const item = items[index]!;
  // Drills are rule-generated and have no card; their events use a stable pseudo id.
  const cardId = item.kind === "drill" ? `drill:${item.drill.track}` : item.card.id;
  const key = item.kind === "drill" ? `drill:${item.drill.track}:${item.drill.seed}` : `${item.kind}:${item.card.id}:${item.kind === "review" ? item.probe.id : ""}`;

  // Record a "view" each time a card appears.
  useEffect(() => {
    shownAt.current = Date.now();
    if (dryRun) {
      if (item.kind !== "drill") markSeenInReview(item.card.id);
      return;
    }
    void store.addEvent({ card_id: cardId, event: "view", ms_spent: 0 });
    track("card.viewed", { card: cardId, type: item.kind === "new" ? item.card.type : item.kind });
  }, [key, cardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const markComplete = useCallback(
    (result?: CardResult) => {
      if (completedRef.current.has(key)) return;
      const ms = Date.now() - shownAt.current;
      setCompleted((s) => new Set(s).add(key));
      if (dryRun) return;
      void store.addEvent({
        card_id: cardId,
        event: "complete",
        ms_spent: ms,
        ...(item.kind === "review" ? { probe_id: item.probe.id, correct: result?.correct ?? false } : {}),
      });
      void recordCompletion(item, { correct: result?.correct, ms });
      void recordActivity();
      if (item.kind === "review") track("recall.answered", { kind: item.probe.kind, correct: result?.correct ?? false });
    },
    [cardId, dryRun, item, key],
  );

  const finish = useCallback(
    (done: Set<string>) => {
      if (dryRun) return onFinish(done.size);
      void store.addSession({ started_at: startedAt.current, source, cards_done: done.size, unlock_granted_min: 0 });
      const kindOf = (it: SessionItem) => (it.kind === "drill" ? `drill:${it.drill.track}:${it.drill.seed}` : `${it.kind}:${it.card.id}:${it.kind === "review" ? it.probe.id : ""}`);
      const finished = items.filter((it) => done.has(kindOf(it)));
      track("session.completed", {
        completed: finished.length,
        reviews: finished.filter((it) => it.kind === "review").length,
        newCards: finished.filter((it) => it.kind === "new").length,
        drills: finished.filter((it) => it.kind === "drill").length,
      });
      onFinish(done.size);
    },
    [dryRun, items, onFinish, source],
  );

  const next = useCallback(() => {
    const done = completedRef.current;
    if (!dryRun && !done.has(key)) void store.addEvent({ card_id: cardId, event: "skip", ms_spent: Date.now() - shownAt.current });
    if (index + 1 >= items.length) return finish(done);
    setIndex(index + 1);
  }, [cardId, dryRun, finish, index, items.length, key]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Swipe left = next card, swipe right = previous. Arrow keys work on desktop.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    // A drag that starts on a slider, button or field belongs to that control, not to card navigation.
    start.current = (e.target as HTMLElement).closest("input, button, textarea, select, a") ? null : { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) (dx < 0 ? next : prev)();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const common = { index, total: items.length, onComplete: markComplete, onNext: next, completed: completed.has(key) };
  const view = (() => {
    if (item.kind === "drill") return <DrillView key={key} spec={item.drill} {...common} />;
    const card = item.card;
    if (item.kind === "review") return <RecallCard key={key} card={card} probe={item.probe} {...common} />;
    switch (card.type) {
      case "story": return <StoryCard key={key} card={card} {...common} />;
      case "fact_why": return <FactWhyCard key={key} card={card} {...common} />;
      case "guess_first": return <GuessFirstCard key={key} card={card} {...common} />;
      case "estimate": return <EstimateCard key={key} card={card} {...common} />;
      case "drill":
      case "recall": return null; // runtime-only types; the engine never emits them as cards
    }
  })();

  return (
    <div className="absolute inset-0 touch-pan-y select-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {view}
      {onExit && (
        <button
          onClick={onExit}
          aria-label="Stop scrolling"
          className="absolute bottom-[max(0.9rem,env(safe-area-inset-bottom))] left-3 z-30 flex h-8 items-center rounded-full bg-black/50 px-3 text-xs text-white/90 backdrop-blur hover:bg-black/70"
        >
          Done for now
        </button>
      )}
    </div>
  );
}
