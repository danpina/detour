import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "@detour/content";
import { store } from "../lib/db";
import { DrillCard } from "./cards/DrillCard";
import { EstimateCard } from "./cards/EstimateCard";
import { FactWhyCard } from "./cards/FactWhyCard";
import { GuessFirstCard } from "./cards/GuessFirstCard";
import { RecallCard } from "./cards/RecallCard";
import { StoryCard } from "./cards/StoryCard";
import type { CardResult } from "./cards/types";

type Props = { cards: Card[]; onFinish: (completed: number) => void };

export function SessionView({ cards, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const shownAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const completedRef = useRef(completed);
  completedRef.current = completed;
  const card = cards[index]!;

  // Record a "view" each time a card appears.
  useEffect(() => {
    shownAt.current = Date.now();
    void store.addEvent({ card_id: card.id, event: "view", ms_spent: 0 });
  }, [card.id]);

  const markComplete = useCallback(
    (_result?: CardResult) => {
      if (completedRef.current.has(card.id)) return;
      setCompleted((s) => new Set(s).add(card.id));
      void store.addEvent({ card_id: card.id, event: "complete", ms_spent: Date.now() - shownAt.current });
    },
    [card.id],
  );

  const finish = useCallback(
    (done: Set<string>) => {
      void store.addSession({ started_at: startedAt.current, source: "free", cards_done: done.size, unlock_granted_min: 0 });
      onFinish(done.size);
    },
    [onFinish],
  );

  const next = useCallback(() => {
    const done = completedRef.current;
    if (!done.has(card.id)) void store.addEvent({ card_id: card.id, event: "skip", ms_spent: Date.now() - shownAt.current });
    if (index + 1 >= cards.length) return finish(done);
    setIndex(index + 1);
  }, [card.id, cards.length, finish, index]);

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

  const common = { index, total: cards.length, onComplete: markComplete, onNext: next, completed: completed.has(card.id) };
  const view = (() => {
    switch (card.type) {
      case "story": return <StoryCard key={card.id} card={card} {...common} />;
      case "fact_why": return <FactWhyCard key={card.id} card={card} {...common} />;
      case "guess_first": return <GuessFirstCard key={card.id} card={card} {...common} />;
      case "estimate": return <EstimateCard key={card.id} card={card} {...common} />;
      case "drill": return <DrillCard key={card.id} card={card} {...common} />;
      case "recall": return <RecallCard key={card.id} card={card} {...common} />;
    }
  })();

  return (
    <div className="absolute inset-0 touch-pan-y select-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {view}
    </div>
  );
}
