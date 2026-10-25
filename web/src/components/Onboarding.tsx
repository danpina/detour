import { useState } from "react";
import { INTERESTS, type Interest } from "@detour/content";
import { INTEREST_INFO } from "../lib/content";

type Props = {
  initial?: Interest[];
  onDone: (interests: Interest[]) => void;
  /** Editing existing topics from Settings: the button says "Save" and there is a way out. */
  editing?: boolean;
  onCancel?: () => void;
  /** The small line above the title: "Detour", or "Step 2 of 2" during the first run. */
  eyebrow?: string;
  /** The label of the way out: "Cancel" when editing, "Back" during the first run. */
  cancelLabel?: string;
};

const MIN = 3;

export function Onboarding({ initial = [], onDone, editing = false, onCancel, eyebrow = "Detour", cancelLabel = "Cancel" }: Props) {
  const [picked, setPicked] = useState<Interest[]>(initial);
  const toggle = (i: Interest) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const left = MIN - picked.length;

  return (
    <div className="flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
      <p className="text-sm font-medium text-teal-700 dark:text-teal-300">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight">What are you curious about?</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">Pick at least {MIN}. You can change this any time.</p>

      <div className="mt-6 grid flex-1 grid-cols-2 content-start gap-3 overflow-auto pb-4">
        {INTERESTS.map((i) => {
          const on = picked.includes(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              aria-pressed={on}
              className={
                "rounded-2xl border p-4 text-left transition active:scale-[0.98] " +
                (on
                  ? "border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-950"
                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700")
              }
            >
              <div className="text-2xl">{INTEREST_INFO[i].emoji}</div>
              <div className="mt-2 font-semibold">{INTEREST_INFO[i].name}</div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400">{INTEREST_INFO[i].blurb}</div>
            </button>
          );
        })}
      </div>

      <button
        disabled={left > 0}
        onClick={() => onDone(picked)}
        className="w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white transition enabled:active:scale-[0.98] disabled:bg-neutral-300 disabled:text-neutral-500 dark:disabled:bg-neutral-800"
      >
        {left > 0 ? `Pick ${left} more` : editing ? "Save" : "Show me a quick one"}
      </button>
      {onCancel && (
        <button onClick={onCancel} className="mt-2 w-full rounded-2xl py-3 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900">
          {cancelLabel}
        </button>
      )}
    </div>
  );
}
