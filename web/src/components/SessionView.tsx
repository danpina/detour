import { useCallback, useEffect, useRef, useState } from "react";
import { store } from "../lib/db";
import type { SessionItem } from "../lib/engine";
import { recordCompletion } from "../lib/session";
import { DrillCard } from "./cards/DrillCard";
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
};

export function SessionView({ items, source, onFinish, onExit }: Props) {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const shownAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const completedRef = useRef(completed);
  completedRef.current = completed;
  const item = items[index]!;
  const card = item.card;
  const key = `${item.kind}:${card.id}:${item.kind === "review" ? item.probe.id : ""}`;

  // Record a "view" each time a card appears.
  useEffect(() => {
    shownAt.current = Date.now();
    void store.addEvent({ card_id: card.id, event: "view", ms_spent: 0 });
  }, [key, card.id]);

  const markComplete = useCallback(
    (result?: CardResult) => {
      if (completedRef.current.has(key)) return;
      const ms = Date.now() - shownAt.current;
      setCompleted((s) => new Set(s).add(key));
      void store.addEvent({
        card_id: card.id,
        event: "complete",
        ms_spent: ms,
        ...(item.kind === "review" ? { probe_id: item.probe.id, correct: result?.correct ?? false } : {}),
      });
      void recordCompletion(item, { correct: result?.correct, ms });
    },
    [card.id, item, key],
  );

  const finish = useCallback(
    (done: Set<string>) => {
      void store.addSession({ started_at: startedAt.current, source, cards_done: done.size, unlock_granted_min: 0 });
      onFinish(done.size);
    },
    [onFinish, source],
  );

  const next = useCallback(() => {
    const done = completedRef.current;
    if (!done.has(key)) void store.addEvent({ card_id: card.id, event: "skip", ms_spent: Date.now() - shownAt.current });
    if (index + 1 >= items.length) return finish(done);
    setIndex(index + 1);
  }, [card.id, finish, index, items.length, key]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Swipe left = next card, swipe right = previous. Arrow keys work on desktop.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
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
    if (item.kind === "review") return <RecallCard key={key} card={card} probe={item.probe} {...common} />;
    switch (card.type) {
      case "story": return <StoryCard key={key} card={card} {...common} />;
      case "fact_why": return <FactWhyCard key={key} card={card} {...common} />;
      case "guess_first": return <GuessFirstCard key={key} card={card} {...common} />;
      case "estimate": return <EstimateCard key={key} card={card} {...common} />;
      case "drill": return <DrillCard key={key} card={card} {...common} />;
      case "recall": return <DrillCard key={key} card={card as never} {...common} />;
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
