import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { track } from "./analytics";
import { listenForInstallPrompt } from "./lib/install";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Offline support: the service worker precaches the app, cards and images. Updates install on next open.
try {
  registerSW({ immediate: true, onOfflineReady: () => window.dispatchEvent(new Event("detour:offline-ready")) });
} catch (e) {
  console.warn("Offline mode unavailable", e);
}

listenForInstallPrompt();
track("app.opened");
