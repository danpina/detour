import { useState } from "react";
import type { Card } from "@detour/content";
import { CardShell } from "../CardShell";
import type { CardViewProps } from "./types";

type Story = Extract<Card, { type: "story" }>;

export function StoryCard({ card, index, total, onComplete, onNext }: CardViewProps<Story>) {
  const [p, setP] = useState(0);
  const panels = card.body.panels;
  const last = p === panels.length - 1;

  const forward = () => {
    if (!last) return setP(p + 1);
    onComplete();
    onNext();
  };
  const back = () => p > 0 && setP(p - 1);

  return (
    <CardShell card={card} index={index} total={total} dim={p > 0}>
      {/* Tap zones: left third = back, rest = forward. Sit under the chrome buttons. */}
      <div className="absolute inset-0 z-10 flex pt-24 pb-14">
        <button aria-label="Previous panel" className="w-1/3 cursor-w-resize" onClick={back} />
        <button aria-label={last ? "Next card" : "Next panel"} className="flex-1 cursor-e-resize" onClick={forward} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {p === 0 && <h1 className="mb-3 text-3xl font-semibold leading-tight tracking-tight">{card.title}</h1>}
        <p className={`${p === 0 ? "text-base text-white/85" : "text-xl leading-snug"} min-h-[7rem]`}>{panels[p]!.text}</p>
        <div className="mt-4 flex items-center justify-between pr-10">
          <div className="flex gap-1.5">
            {panels.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === p ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
            ))}
          </div>
          <span className="text-xs text-white/60">{last ? "Tap for the next card" : "Tap to continue"}</span>
        </div>
      </div>
    </CardShell>
  );
}
