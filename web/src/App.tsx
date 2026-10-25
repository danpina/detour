import { useCallback, useEffect, useState } from "react";
import type { Interest } from "@detour/content";
import { BottomNav, type Tab } from "./components/BottomNav";
import { EndScreen } from "./components/EndScreen";
import { GamesScreen } from "./components/GamesScreen";
import { HomeScreen } from "./components/HomeScreen";
import { FirstRun } from "./components/FirstRun";
import { Onboarding } from "./components/Onboarding";
import { ProgressScreen } from "./components/ProgressScreen";
import { SessionView } from "./components/SessionView";
import { SettingsScreen } from "./components/SettingsScreen";
import { Toaster, toast } from "./components/Toast";
import { track } from "./analytics";
import { store } from "./lib/db";
import type { SessionItem } from "./lib/engine";
import { EVENT_RETENTION_DAYS } from "./lib/progress";
import { ALL_CARDS } from "./lib/content";
import { seenInReview } from "./lib/reviewer";
import { nextSet } from "./lib/session";

type Screen =
  | { name: "loading" }
  | { name: "onboarding" }
  | { name: "interests" }
  | { name: Tab }
  | { name: "session"; items: SessionItem[]; run: number; feed: boolean; dryRun?: boolean }
  | { name: "end"; learned: number };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "loading" });
  const [interests, setInterests] = useState<Interest[]>([]);

  const load = useCallback(async () => {
    const s = await store.getSettings();
    if (s?.onboarding_done) {
      setInterests(s.interests);
      setScreen({ name: "home" });
    } else {
      setInterests([]);
      setScreen({ name: "onboarding" });
    }
  }, []);

  useEffect(() => {
    const ready = () => toast("Ready to use offline");
    window.addEventListener("detour:offline-ready", ready);
    return () => window.removeEventListener("detour:offline-ready", ready);
  }, []);

  useEffect(() => {
    void store.pruneEvents(EVENT_RETENTION_DAYS * 86_400_000).then(load);
  }, [load]);

  /** Starts a 5-card set; in feed mode the next set follows seamlessly (free scroll = same engine, endless). */
  const startSet = useCallback(async (ints: Interest[], feed: boolean) => {
    const items = await nextSet(ints);
    track("session.started", { mode: feed ? "feed" : "set", cards: items.length });
    setScreen((s) => ({ name: "session", items, feed, run: (s.name === "session" ? s.run : 0) + 1 }));
  }, []);

  /** Reviewer mode: a batch of agent-approved cards not looked at yet. Nothing is recorded as progress. */
  const startReview = useCallback(() => {
    const seen = seenInReview();
    const items: SessionItem[] = ALL_CARDS.filter((c) => c.review?.by === "agent" && !seen.has(c.id))
      .slice(0, 12)
      .map((card) => ({ kind: "new", card }));
    if (!items.length) return;
    setScreen((s) => ({ name: "session", items, feed: false, dryRun: true, run: (s.name === "session" ? s.run : 0) + 1 }));
  }, []);

  /** Saving topics from Settings: keep everything else and go back to Settings (no new set is started). */
  const saveInterests = async (picked: Interest[]) => {
    setInterests(picked);
    await store.saveSettings({ ...(await store.getSettings()), id: "main", interests: picked, onboarding_done: true });
    setScreen({ name: "settings" });
  };

  const finishOnboarding = async (picked: Interest[]) => {
    setInterests(picked);
    await store.saveSettings({ ...(await store.getSettings()), id: "main", interests: picked, onboarding_done: true });
    track("onboarding.completed", { interests: picked.length });
    await startSet(picked, false);
  };

  const tab: Tab | null = screen.name === "home" || screen.name === "games" || screen.name === "progress" || screen.name === "settings" ? screen.name : null;

  return (
    // Phone-sized column, centred on larger screens.
    <div className="flex min-h-dvh justify-center bg-neutral-200 dark:bg-black">
      <div className="relative h-dvh w-full max-w-[430px] overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50 md:shadow-2xl">
        {screen.name === "loading" && <div className="flex h-full items-center justify-center text-neutral-400">Loading…</div>}

        {screen.name === "onboarding" && <FirstRun initial={interests} onDone={finishOnboarding} />}

        {screen.name === "interests" && <Onboarding initial={interests} editing onDone={saveInterests} onCancel={() => setScreen({ name: "settings" })} />}

        {screen.name === "home" && <HomeScreen onReview={startReview} onStart={(feed) => startSet(interests, feed)} onOpenSettings={() => setScreen({ name: "settings" })} onOpenProgress={() => setScreen({ name: "progress" })} />}

        {screen.name === "games" && <GamesScreen />}

        {screen.name === "progress" && <ProgressScreen />}

        {screen.name === "settings" && (
          <SettingsScreen interests={interests} onChangeInterests={() => setScreen({ name: "interests" })} onDataChanged={() => void load()} />
        )}

        {screen.name === "session" && (
          <SessionView
            key={screen.run}
            items={screen.items}
            source="free"
            dryRun={screen.dryRun}
            onFinish={(n) => (screen.dryRun ? setScreen({ name: "home" }) : screen.feed ? void startSet(interests, true) : setScreen({ name: "end", learned: n }))}
            onExit={screen.feed ? () => setScreen({ name: "home" }) : undefined}
          />
        )}

        {screen.name === "end" && (
          <EndScreen learned={screen.learned} onAnother={() => startSet(interests, false)} onProgress={() => setScreen({ name: "progress" })} onDone={() => setScreen({ name: "home" })} />
        )}

        <Toaster />
        {tab && <BottomNav tab={tab} onChange={(t) => setScreen({ name: t })} />}
      </div>
    </div>
  );
}
