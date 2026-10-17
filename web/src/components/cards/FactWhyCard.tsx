import { useState } from "react";
import type { Card } from "@detour/content";
import { CardShell } from "../CardShell";
import type { CardViewProps } from "./types";

type FactWhy = Extract<Card, { type: "fact_why" }>;

export function FactWhyCard({ card, index, total, onComplete, onNext, completed }: CardViewProps<FactWhy>) {
  const [revealed, setRevealed] = useState(completed);

  return (
    <CardShell card={card} index={index} total={total} dim={revealed}>
      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <p className="mb-2 text-xs uppercase tracking-widest text-white/60">{card.title}</p>
        <h1 className="text-2xl font-semibold leading-snug">{card.body.claim}</h1>

        {revealed ? (
          <>
            <p className="mt-4 text-base leading-relaxed text-white/90">{card.body.why}</p>
            <button onClick={onNext} className="mt-6 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900 active:scale-[0.98]">
              Next
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setRevealed(true);
              onComplete();
            }}
            className="mt-6 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900 active:scale-[0.98]"
          >
            Why?
          </button>
        )}
      </div>
    </CardShell>
  );
}
