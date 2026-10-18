import { useEffect, useState } from "react";

/** A short message at the top of the screen. Listens for `detour:toast` events with the text as detail. */
export function Toaster() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (e: Event) => {
      setText(String((e as CustomEvent<string>).detail));
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 3500);
    };
    window.addEventListener("detour:toast", show);
    return () => {
      window.removeEventListener("detour:toast", show);
      clearTimeout(timer);
    };
  }, []);

  if (!text) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-neutral-900">{text}</div>
    </div>
  );
}

export const toast = (text: string) => window.dispatchEvent(new CustomEvent("detour:toast", { detail: text }));
