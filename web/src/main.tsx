import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import { App } from "./App";
import { track } from "./analytics";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support: the service worker precaches the app, cards and images. Updates install on next open.
try {
  registerSW({ immediate: true });
} catch (e) {
  console.warn("Offline mode unavailable", e);
}

track("app.opened");
