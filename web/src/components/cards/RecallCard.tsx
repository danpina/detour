import { useState } from "react";
import type { Card, Probe } from "@detour/content";
import { CardShell } from "../CardShell";
import { SliderGuess } from "../SliderGuess";
import { cardById } from "../../lib/content";
import type { CardViewProps } from "./types";

type Recall = Extract<Card, { type: "recall" }>;

/** A probe resurfaced later. Uses the source card's image as a visual cue. */
export function RecallCard({ card, index, total, onComplete, onNext }: CardViewProps<Recall>) {
  const source = cardById(card.body.probe_id.replace(/-p\d$/, ""));
  const probe = source?.probes.find((p) => p.id === card.body.probe_id);
  const [answered, setAnswered] = useState<null | boolean>(null);

  if (!source || !probe) {
    return (
      <CardShell card={card} index={index} total={total}>
        <div className="absolute inset-x-0 bottom-0 z-10 p-6">
          <p>This reminder is no longer available.</p>
          <button onClick={onNext} className="mt-5 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900">
            Next
          </button>
        </div>
      </CardShell>
    );
  }

  const finish = (correct: boolean) => {
    setAnswered(correct);
    onComplete({ correct });
  };

  return (
    <CardShell card={source} index={index} total={total} dim>
      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <p className="mb-2 text-xs uppercase tracking-widest text-white/60">Quick one: do you remember?</p>
        <h1 className="mb-5 text-xl font-semibold leading-snug">{probe.question}</h1>
        <ProbeInput probe={probe} locked={answered !== null} onAnswer={finish} />
        {answered !== null && (
          <>
            <p className="mt-4 text-sm font-medium">{answered ? "Nice, you remembered." : "Not this time. It'll come back soon."}</p>
            <button onClick={onNext} className="mt-5 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900 active:scale-[0.98]">
              Next
            </button>
          </>
        )}
      </div>
    </CardShell>
  );
}

function ProbeInput({ probe, locked, onAnswer }: { probe: Probe; locked: boolean; onAnswer: (correct: boolean) => void }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<number | null>(null);

  const btn = (i: number, label: string, correct: boolean) => {
    const state = picked === null ? "idle" : correct ? "right" : i === picked ? "wrong" : "muted";
    return (
      <button
        key={label}
        disabled={locked}
        onClick={() => {
          setPicked(i);
          onAnswer(correct);
        }}
        className={
          "w-full rounded-2xl border px-4 py-3.5 text-left font-medium transition " +
          (state === "idle" ? "border-white/30 bg-white/15 backdrop-blur hover:bg-white/25" : "") +
          (state === "right" ? "border-emerald-300 bg-emerald-500/40" : "") +
          (state === "wrong" ? "border-rose-300 bg-rose-500/30" : "") +
          (state === "muted" ? "border-white/10 bg-white/5 text-white/50" : "")
        }
      >
        {label}
      </button>
    );
  };

  switch (probe.kind) {
    case "mcq":
      return <div className="space-y-2.5">{probe.options.map((o, i) => btn(i, o, i === probe.answer))}</div>;
    case "tf":
      return (
        <div className="space-y-2.5">
          {btn(0, "True", probe.answer === true)}
          {btn(1, "False", probe.answer === false)}
        </div>
      );
    case "cloze": {
      const accepted = [probe.answer, ...probe.accept].map((s) => s.trim().toLowerCase());
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked && text.trim()) onAnswer(accepted.includes(text.trim().toLowerCase()));
          }}
        >
          <input
            value={text}
            disabled={locked}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer"
            className="w-full rounded-2xl border border-white/30 bg-white/15 px-4 py-3.5 text-white placeholder-white/50 backdrop-blur outline-none focus:border-white"
          />
          {!locked && (
            <button type="submit" className="mt-3 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900">
              Check
            </button>
          )}
        </form>
      );
    }
    case "estimate":
      return (
        <SliderGuess
          min={probe.min}
          max={probe.max}
          scale={probe.scale}
          unit={probe.unit}
          answer={probe.answer}
          onLock={(score) => onAnswer(score >= 0.85)}
        />
      );
  }
}
