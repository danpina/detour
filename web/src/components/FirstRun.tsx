import { useState } from "react";
import type { Interest } from "@detour/content";
import { LANGUAGES, LEVEL_NAMES, getLanguage, getLevel, setLanguage, setLevel, type LanguageId } from "../games/language/languageData";
import type { Level } from "../games/language/languageLogic";
import { Onboarding } from "./Onboarding";

type Props = { initial?: Interest[]; onDone: (interests: Interest[]) => void };

const LEVEL_BLURB: Record<Level, string> = { 1: "First words", 2: "Everyday talk", 3: "Ideas and nuance" };

/** What a new user sees first: which language to pick up (and how hard), then what they are curious about. Both can be changed later. */
export function FirstRun({ initial = [], onDone }: Props) {
  const [step, setStep] = useState<"language" | "interests">("language");
  const [interests, setInterests] = useState<Interest[]>(initial);
  const [languageId, setLanguageId] = useState<LanguageId>(() => getLanguage().id);
  const [level, setLevelState] = useState<Level>(getLevel);

  if (step === "interests") {
    return (
      <Onboarding
        initial={interests}
        eyebrow="Step 2 of 2"
        cancelLabel="Back"
        onCancel={() => setStep("language")}
        onDone={(picked) => {
          setInterests(picked);
          onDone(picked);
        }}
      />
    );
  }

  const choice = "rounded-2xl border p-4 text-left transition active:scale-[0.98] ";
  const on = "border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-950";
  const off = "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700";

  return (
    <div className="flex h-full flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
      <p className="text-sm font-medium text-teal-700 dark:text-teal-300">Step 1 of 2</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight">Want to pick up a language?</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">A few words at a time, between everything else. You can switch any time in Games.</p>

      <div className="mt-6 space-y-3" role="group" aria-label="Language">
        {LANGUAGES.map((l) => (
          <button
            key={l.id}
            aria-pressed={languageId === l.id}
            onClick={() => {
              setLanguage(l.id);
              setLanguageId(l.id);
            }}
            className={choice + "flex w-full items-center gap-4 " + (languageId === l.id ? on : off)}
          >
            <span className="text-3xl">{l.flag}</span>
            <span className="flex-1 font-semibold">{l.name}</span>
            {languageId === l.id && <span className="text-teal-600 dark:text-teal-400">✓</span>}
          </button>
        ))}
      </div>

      <p className="mt-6 font-semibold">How much do you know?</p>
      <div className="mt-2 flex gap-2" role="group" aria-label="Level">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            aria-pressed={level === n}
            onClick={() => {
              setLevel(n);
              setLevelState(n);
            }}
            className={"min-h-11 flex-1 rounded-full border px-3 py-1.5 text-sm font-medium " + (level === n ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-200" : "border-neutral-300 dark:border-neutral-700")}
          >
            {LEVEL_NAMES[n]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{LEVEL_BLURB[level]}</p>

      <div className="flex-1" />
      <button onClick={() => setStep("interests")} className="w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white transition active:scale-[0.98]">
        Next
      </button>
      <button onClick={() => setStep("interests")} className="mt-2 w-full rounded-2xl py-3 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900">
        Not now
      </button>
    </div>
  );
}
