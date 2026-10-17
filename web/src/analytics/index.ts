import TelemetryDeck from "@telemetrydeck/sdk";
import type { SignalName, SignalPayloads, SignalValue } from "./signals";

type Sender = (type: string, payload: Record<string, SignalValue>) => unknown;

const OPT_OUT_KEY = "detour.analytics";
const ID_KEY = "detour.install";

// ---------- local preferences (storage may be blocked, so every access is guarded) ----------

export function analyticsEnabled(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAnalyticsEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, "off");
  } catch {
    // nothing to persist; the choice lasts until reload
  }
  enabledOverride = on;
}
let enabledOverride: boolean | undefined;
const isOn = () => enabledOverride ?? analyticsEnabled();

/** A random id that never leaves the device unhashed. It lets retention be counted without knowing who anyone is. */
function installId(): string {
  const make = () => crypto.randomUUID();
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = make();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return make();
  }
}

// ---------- sending ----------

let sender: Sender | null | undefined; // undefined = not set up yet, null = disabled

function setup(): Sender | null {
  const appID = import.meta.env.VITE_TELEMETRYDECK_APP_ID as string | undefined;
  if (!appID) return null;
  try {
    const td = new TelemetryDeck({ appID, clientUser: installId(), testMode: import.meta.env.DEV });
    return (type, payload) => td.signal(type, payload);
  } catch {
    return null;
  }
}

/** Sends one anonymous signal. Does nothing without an app id, when the user opted out, or on any error. */
export function track<K extends SignalName>(name: K, payload?: SignalPayloads[K]): void {
  if (!isOn()) return;
  if (sender === undefined) sender = setup();
  if (!sender) return;
  try {
    const result = sender(name, { ...(payload as Record<string, SignalValue> | undefined) });
    void Promise.resolve(result).catch(() => undefined);
  } catch {
    // analytics must never break the app
  }
}

/** For tests. */
export function __setSender(s: Sender | null | undefined): void {
  sender = s;
  enabledOverride = undefined;
}
