import { useEffect, type ReactNode } from "react";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="max-h-[80%] w-full overflow-auto rounded-t-3xl bg-white p-5 pb-8 text-neutral-900 shadow-2xl dark:bg-neutral-900 dark:text-neutral-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
