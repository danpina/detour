import { useState } from "react";
import type { Card } from "@detour/content";
import { CardShell } from "../CardShell";
import { SliderGuess } from "../SliderGuess";
import type { CardViewProps } from "./types";

type Estimate = Extract<Card, { type: "estimate" }>;

export function EstimateCard({ card, index, total, onComplete, onNext }: CardViewProps<Estimate>) {
  const [done, setDone] = useState(false);
  const b = card.body;

  return (
    <CardShell card={card} index={index} total={total} dim>
      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <p className="mb-2 text-xs uppercase tracking-widest text-white/60">Your best estimate</p>
        <h1 className="mb-6 text-xl font-semibold leading-snug">{b.question}</h1>

        <SliderGuess
          min={b.min}
          max={b.max}
          scale={b.scale}
          unit={b.unit}
          answer={b.answer}
          onLock={(score) => {
            setDone(true);
            onComplete({ correct: score >= 0.85 });
          }}
        />

        {done && (
          <>
            <p className="mt-4 text-sm leading-relaxed text-white/90">{b.reveal}</p>
            <button onClick={onNext} className="mt-5 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900 active:scale-[0.98]">
              Next
            </button>
          </>
        )}
      </div>
    </CardShell>
  );
}
