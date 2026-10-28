import { useEffect, useState } from "react";
import { TRACKS, TRACK_IDS, type SkillProgress, type TrackId } from "../lib/drills";
import { store } from "../lib/db";

type Props = { onBack: () => void; backLabel: string };

/** Which math skills are in your rounds. A card per skill with your level in it; at least one stays on. */
export function MathSkillsScreen({ onBack, backLabel }: Props) {
  const [off, setOff] = useState<string[]>([]);
  const [skills, setSkills] = useState<SkillProgress[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    void store.getSettings().then((s) => setOff(s?.math_off ?? []));
    void store.getSkills().then(setSkills);
  }, []);

  const toggle = async (id: TrackId) => {
    const isOn = !off.includes(id);
    if (isOn && TRACK_IDS.length - off.length <= 1) {
      setNote("Keep at least one skill on, so a math round has something to ask.");
      return;
    }
    setNote("");
    const next = isOn ? [...off, id] : off.filter((t) => t !== id);
    setOff(next);
    const s = await store.getSettings();
    if (s) await store.saveSettings({ ...s, math_off: next });
  };

  return (
    <div className="flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button onClick={onBack} className="min-h-11 self-start text-left text-neutral-500 dark:text-neutral-400">← {backLabel}</button>
      <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight">Your math skills</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">Math rounds mix the skills you leave on. Tap one to switch it.</p>

      <ul className="mt-5 grid flex-1 content-start gap-2 overflow-auto pb-4">
        {TRACK_IDS.map((id) => {
          const on = !off.includes(id);
          const t = TRACKS[id];
          const row = skills.find((s) => s.track_id === id);
          return (
            <li key={id}>
              <button
                role="switch"
                aria-checked={on}
                onClick={() => void toggle(id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${on ? "border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-950" : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"}`}
              >
                <span className="flex-1">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block text-sm text-neutral-500 dark:text-neutral-400">
                    {row && row.attempts_total > 0 ? `Level ${row.level} of ${t.maxLevel}` : `Not started · ${t.blurb.toLowerCase()}`}
                  </span>
                </span>
                <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-md border text-sm ${on ? "border-teal-600 bg-teal-600 text-white" : "border-neutral-300 dark:border-neutral-600"}`}>{on ? "✓" : ""}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="min-h-5 text-sm text-neutral-500 dark:text-neutral-400" aria-live="polite">{note}</p>
      <button onClick={onBack} className="min-h-14 rounded-2xl bg-teal-600 px-6 py-3 text-lg font-semibold text-white active:scale-[0.98]">Done</button>
    </div>
  );
}
