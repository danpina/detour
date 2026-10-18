const DISMISS_KEY = "detour.installDismissed";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallPromptEvent | null = null;

/** Call once at startup: remembers the browser's install prompt so we can offer it at a good moment. */
export function listenForInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    window.dispatchEvent(new Event("detour:install-available"));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
  });
}

export const isInstalled = (): boolean => {
  try {
    return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
};

export const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // it may show again next time; harmless
  }
}

export type InstallHint = "prompt" | "ios" | null;

/** What to offer: the browser's own install prompt, iOS instructions, or nothing. Shown only after the first set. */
export function installHint(ctx: { installed: boolean; dismissed: boolean; sessions: number; canPrompt: boolean; ios: boolean }): InstallHint {
  if (ctx.installed || ctx.dismissed || ctx.sessions < 1) return null;
  if (ctx.canPrompt) return "prompt";
  return ctx.ios ? "ios" : null;
}

export const canPromptInstall = () => deferred !== null;

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === "accepted";
}
