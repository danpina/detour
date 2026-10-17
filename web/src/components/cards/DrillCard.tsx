import { useEffect } from "react";
import type { Card } from "@detour/content";
import { CardShell } from "../CardShell";
import type { CardViewProps } from "./types";

type Drill = Extract<Card, { type: "drill" }>;

/** Placeholder: rule-generated skill drills arrive in Step 8. */
export function DrillCard({ card, index, total, onComplete, onNext }: CardViewProps<Drill>) {
  useEffect(() => onComplete(), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <CardShell card={card} index={index} total={total}>
      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-10">
        <h1 className="text-2xl font-semibold">Skill drills are on the way</h1>
        <p className="mt-2 text-white/80">Mental math and estimation practice will show up here.</p>
        <button onClick={onNext} className="mt-6 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900">
          Next
        </button>
      </div>
    </CardShell>
  );
}
