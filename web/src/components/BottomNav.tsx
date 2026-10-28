export type Tab = "home" | "games" | "progress" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⚡" },
  { id: "games", label: "Games", icon: "🎮" },
  { id: "progress", label: "Progress", icon: "📈" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav aria-label="Main" className="absolute inset-x-0 bottom-0 z-20 flex border-t border-neutral-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-current={tab === t.id ? "page" : undefined}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${tab === t.id ? "font-semibold text-teal-700 dark:text-teal-300" : "text-neutral-500 dark:text-neutral-400"}`}
        >
          <span aria-hidden="true" className="text-lg leading-none">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
