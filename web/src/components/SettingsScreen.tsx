import { useRef, useState } from "react";
import { INTEREST_INFO } from "../lib/content";
import type { Interest } from "@detour/content";
import { backupFileName, buildBackup, parseBackup } from "../lib/backup";
import { store } from "../lib/db";

const box = "rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";
const btn = "w-full rounded-xl border border-neutral-300 px-4 py-3 text-left font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

type Props = { interests: Interest[]; onChangeInterests: () => void; onDataChanged: () => void };

const isInstalled = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function SettingsScreen({ interests, onChangeInterests, onDataChanged }: Props) {
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const exportProgress = async () => {
    const blob = new Blob([buildBackup(await store.snapshot())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

      <section className={`${box} mt-5`}>
        <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Your interests</h2>
        <p className="mt-2">{interests.map((i) => `${INTEREST_INFO[i].emoji} ${INTEREST_INFO[i].name}`).join(" · ") || "None yet"}</p>
        <button onClick={onChangeInterests} className={`${btn} mt-3`}>Change interests</button>
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
