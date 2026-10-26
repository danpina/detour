import { useEffect, useRef, useState } from "react";
import { INTEREST_INFO } from "../lib/content";
import type { Interest } from "@detour/content";
import { backupFileName, buildBackup, parseBackup } from "../lib/backup";
import { analyticsEnabled, setAnalyticsEnabled } from "../analytics";
import { store } from "../lib/db";
import { setLastBackup } from "../lib/home";
import { isInstalled } from "../lib/install";
import { buildReminderIcs, parseTime } from "../lib/reminder";
import { SEND_BACK_REASONS, clearSendBack, exportSendBack, getSendBack, isReviewer, resetReviewProgress, setReviewer, undoSendBack } from "../lib/reviewer";

const box = "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";
const btn = "w-full rounded-xl border border-neutral-300 px-4 py-3 text-left font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

type Props = { interests: Interest[]; onChangeInterests: () => void; onDataChanged: () => void };

export function SettingsScreen({ interests, onChangeInterests, onDataChanged }: Props) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [shareStats, setShareStats] = useState(analyticsEnabled());
  const [, setReviewTick] = useState(0);
  const reviewer = isReviewer();
  const sentBack = reviewer ? getSendBack() : [];
  const refreshReview = () => setReviewTick((t) => t + 1);
  const [setSize, setSetSize] = useState(5);
  const [reminderTime, setReminderTime] = useState("20:00");

  useEffect(() => {
    void store.getSettings().then((s) => {
      setSetSize(s?.set_size ?? 5);
    });
  }, []);

  const exportProgress = async () => {
    const blob = new Blob([buildBackup(await store.snapshot())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setLastBackup();
    setMsg({ text: "Saved. Keep the file somewhere safe: it's your whole progress." });
  };

  const importProgress = async (f: File) => {
    const parsed = parseBackup(await f.text());
    if (!parsed.ok) return setMsg({ text: parsed.error, error: true });
    const when = new Date(parsed.exported_at).toLocaleDateString();
    if (!confirm(`Replace the progress on this device with the backup from ${when}? This can't be undone.`)) return;
    await store.replaceAll(parsed.data);
    setMsg({ text: `Imported ${parsed.data.reviews.length} reminders and ${parsed.data.events.length} events.` });
    onDataChanged();
  };

  const erase = async () => {
    if (!confirm("Erase all progress on this device? Export first if you want to keep it.")) return;
    await store.clearAll();
    onDataChanged();
  };

  return (
    <div className="h-full overflow-auto px-5 pb-28 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

      {reviewer && (
        <section className="mt-5 rounded-2xl border-2 border-rose-500 p-4">
          <h2 className="text-sm font-semibold text-rose-700 dark:text-rose-300">Reviewer mode</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {sentBack.length === 0
              ? "Tap \"Send back\" on any card to put it in this list."
              : `${sentBack.length} ${sentBack.length === 1 ? "card" : "cards"} to send back. Export the list, then run: pnpm tools sendback <file>`}
          </p>
          {sentBack.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {sentBack.map((i) => (
                <li key={i.card_id} className="flex items-center justify-between gap-2">
                  <span>
                    <strong>{i.card_id}</strong> · {SEND_BACK_REASONS.find(([c]) => c === i.reason)?.[1]}
                    {i.note ? ` · ${i.note}` : ""}
                  </span>
                  <button
                    onClick={() => {
                      undoSendBack(i.card_id);
                      refreshReview();
                    }}
                    className="text-neutral-500 underline"
                  >
                    undo
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-2">
            <button
              disabled={sentBack.length === 0}
              onClick={async () => {
                const text = exportSendBack(sentBack);
                try {
                  await navigator.clipboard.writeText(text);
                  setMsg({ text: "Copied. Paste it into a file called sendback.json." });
                } catch {
                  setMsg({ text: "Could not copy. Use Download instead.", error: true });
                }
              }}
              className={`${btn} disabled:opacity-40`}
            >
              Copy list
            </button>
            <button
              disabled={sentBack.length === 0}
              onClick={() => {
                const url = URL.createObjectURL(new Blob([exportSendBack(sentBack)], { type: "application/json" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = "sendback.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
              className={`${btn} disabled:opacity-40`}
            >
              Download sendback.json
            </button>
            <button
              onClick={() => {
                if (!confirm("Clear the whole send-back list? Do this after you have run the send-back tool.")) return;
                clearSendBack();
                refreshReview();
              }}
              className={btn}
            >
              Clear list
            </button>
            <button
              onClick={() => {
                resetReviewProgress();
                refreshReview();
              }}
              className={btn}
            >
              Start review mode over (show all cards again)
            </button>
            <button
              onClick={() => {
                setReviewer(false);
                refreshReview();
              }}
              className={btn}
            >
              Turn off reviewer mode
            </button>
          </div>
        </section>
      )}
      <section className={`${box} mt-5`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Your interests</h2>
        <p className="mt-2">{interests.map((i) => `${INTEREST_INFO[i].emoji} ${INTEREST_INFO[i].name}`).join(" · ") || "None yet"}</p>
        <button onClick={onChangeInterests} className={`${btn} mt-3`}>Change interests</button>
      </section>

      <section className={`${box} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Round length</h2>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Round length">
          {[3, 5, 8].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={setSize === n}
              onClick={async () => {
                setSetSize(n);
                const s = await store.getSettings();
                if (s) await store.saveSettings({ ...s, set_size: n });
              }}
              className={`rounded-xl border px-3 py-3 font-medium ${setSize === n ? "border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-100" : "border-neutral-300 dark:border-neutral-700"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">How many things in each round: 3 means 3 cards, 3 math problems or 3 games. Five is about a minute.</p>
      </section>

      <section className={`${box} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Daily reminder</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Detour can't send notifications on its own, but your calendar can. This adds a repeating event with an alert.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            aria-label="Reminder time"
            className="rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
          />
          <button
            onClick={() => {
              const { hour, minute } = parseTime(reminderTime);
              const ics = buildReminderIcs({ hour, minute, url: location.origin + import.meta.env.BASE_URL });
              const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = "detour-reminder.ics";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setMsg({ text: "Open the file to add the reminder to your calendar." });
            }}
            className="flex-1 rounded-xl border border-neutral-300 px-4 py-2.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Add to calendar
          </button>
        </div>
      </section>

      <section className={`${box} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Your data</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Everything stays on this device. No account, nothing uploaded.</p>
        <div className="mt-3 space-y-2">
          <button onClick={exportProgress} className={btn}>Export progress</button>
          <button onClick={() => file.current?.click()} className={btn}>Import progress</button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importProgress(f);
            }}
          />
          <button onClick={erase} className={`${btn} text-rose-600 dark:text-rose-400`}>Erase everything</button>
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.error ? "text-rose-600 dark:text-rose-400" : "text-teal-700 dark:text-teal-300"}`}>{msg.text}</p>}
      </section>

      <section className={`${box} mt-4`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Anonymous usage numbers</h2>
        <label className="mt-2 flex items-start gap-3">
          <input
            type="checkbox"
            checked={shareStats}
            onChange={(e) => {
              setShareStats(e.target.checked);
              setAnalyticsEnabled(e.target.checked);
            }}
            className="mt-1 h-5 w-5 accent-teal-600"
          />
          <span className="text-sm">
            Help improve Detour by sharing simple counts, like how many cards were viewed and how often people remember them. Never your name, answers or interests.
          </span>
        </label>
      </section>

      <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {import.meta.env.VITE_FEEDBACK_URL && (
          <>
            <a className="underline" href={import.meta.env.VITE_FEEDBACK_URL as string} target="_blank" rel="noreferrer">
              Send feedback
            </a>
            {" · "}
          </>
        )}
        <a className="underline" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
          Privacy
        </a>
      </p>

      {!isInstalled() && (
        <section className={`${box} mt-4`}>
          <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Keep your progress safe</h2>
          <p className="mt-2 text-sm">
            Add Detour to your Home Screen. On iPhone: tap Share, then "Add to Home Screen". Safari can clear a website's data after about a week of not using it, and an installed app avoids that.
          </p>
        </section>
      )}
    </div>
  );
}
