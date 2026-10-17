import { useCallback, useEffect, useState } from "react";
import type { Card, Interest } from "@detour/content";
import { EndScreen } from "./components/EndScreen";
import { Onboarding } from "./components/Onboarding";
import { SessionView } from "./components/SessionView";
import { ALL_CARDS } from "./lib/content";
import { store } from "./lib/db";
import { pickSet } from "./lib/pickSet";

type Screen =
  | { name: "loading" }
  | { name: "onboarding" }
  | { name: "home" }
  | { name: "session"; cards: Card[]; run: number }
  | { name: "end"; learned: number };

const SET_SIZE = 5;

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "loading" });
  const [interests, setInterests] = useState<Interest[]>([]);

  useEffect(() => {
    void store.getSettings().then((s) => {
      if (s?.onboarding_done) {
        setInterests(s.interests);
        setScreen({ name: "home" });
      } else setScreen({ name: "onboarding" });
    });
  }, []);

  const startSet = useCallback(async (ints: Interest[]) => {
    const seen = await store.completedCardIds();
    const cards = pickSet(ALL_CARDS, ints, seen, SET_SIZE);
    setScreen((s) => ({ name: "session", cards, run: (s.name === "session" ? s.run : 0) + 1 }));
  }, []);

  const finishOnboarding = async (picked: Interest[]) => {
    setInterests(picked);
    await store.saveSettings({ id: "main", interests: picked, onboarding_done: true });
    await startSet(picked);
  };

  return (
    // Phone-sized column, centred on larger screens.
    <div className="flex min-h-dvh justify-center bg-neutral-200 dark:bg-black">
      <div className="relative h-dvh w-full max-w-[430px] overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50 md:my-0 md:shadow-2xl">
        {screen.name === "loading" && <div className="flex h-full items-center justify-center text-neutral-400">Loading…</div>}

        {screen.name === "onboarding" && <Onboarding initial={interests} onDone={finishOnboarding} />}

        {screen.name === "home" && (
          <div className="flex h-full flex-col justify-center px-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Quick one?</h1>
            <p className="mt-2 text-neutral-500 dark:text-neutral-400">Five small cards, about a minute.</p>
            <button onClick={() => startSet(interests)} className="mt-8 w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white active:scale-[0.98]">
              Let's go
            </button>
            <button onClick={() => setScreen({ name: "onboarding" })} className="mt-3 rounded-2xl py-3 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900">
              Change my interests
            </button>
          </div>
        )}

        {screen.name === "session" && (
          <SessionView key={screen.run} cards={screen.cards} onFinish={(n) => setScreen({ name: "end", learned: n })} />
        )}

        {screen.name === "end" && (
          <EndScreen learned={screen.learned} onAnother={() => startSet(interests)} onInterests={() => setScreen({ name: "onboarding" })} />
        )}
      </div>
    </div>
  );
}
