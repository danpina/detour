import { useState } from "react";
import { closeness, closenessLabel, formatNumber, positionOf, tidy, valueAt, type Scale } from "../lib/scoring";

type Props = {
  min: number;
  max: number;
  scale: Scale;
  unit: string;
  answer: number;
  /** Called with closeness (0..1) after the user locks in. */
  onLock: (score: number) => void;
  disabled?: boolean;
};

/** Estimate slider: drag, lock in, see how close you were. Shared by Estimate and Recall cards. */
export function SliderGuess({ min, max, scale, unit, answer, onLock }: Props) {
  const [t, setT] = useState(0.5);
  const [locked, setLocked] = useState(false);
  const value = tidy(valueAt(t, min, max, scale));
  const score = locked ? closeness(value, answer, min, max, scale) : 0;
  const unitLabel = unit === "%" ? "%" : ` ${unit}`;

  return (
    <div>
      <div className="text-center">
        <div className="text-5xl font-semibold tabular-nums">
          {formatNumber(value)}
          <span className="ml-1 text-xl text-white/70">{unitLabel}</span>
        </div>
      </div>

      <div className="relative mt-6 px-1">
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(t * 1000)}
          disabled={locked}
          onChange={(e) => setT(Number(e.target.value) / 1000)}
          aria-label="Your estimate"
          className="h-10 w-full accent-white"
        />
        {locked && (
          <div
            className="pointer-events-none absolute top-1 h-8 w-1 -translate-x-1/2 rounded bg-emerald-300"
            style={{ left: `calc(${positionOf(answer, min, max, scale) * 100}% )` }}
            title="Answer"
          />
        )}
        <div className="mt-1 flex justify-between text-xs text-white/60">
          <span>{formatNumber(min)}</span>
          <span>{formatNumber(max)}</span>
        </div>
      </div>

      {!locked ? (
        <button
          onClick={() => {
            setLocked(true);
            onLock(closeness(value, answer, min, max, scale));
          }}
          className="mt-5 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900 active:scale-[0.98]"
        >
          Lock it in
        </button>
      ) : (
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-center backdrop-blur">
          <div className="text-sm text-white/70">
            You said {formatNumber(value)}
            {unitLabel} · Answer {formatNumber(answer)}
            {unitLabel}
          </div>
          <div className="mt-1 text-lg font-semibold">{closenessLabel(score)}</div>
        </div>
      )}
    </div>
  );
}
