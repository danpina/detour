# Deploying the web prototype

The site is a static build served by GitHub Pages at `https://danpina.github.io/detour/`.

## One-time setup

1. **Enable Pages:** GitHub repo → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. **TelemetryDeck (anonymous analytics):** create an account at telemetrydeck.com, create an app, and copy its App ID.
3. **Add the App ID:** repo → Settings → Secrets and variables → Actions → **Variables** tab → New repository variable `TELEMETRYDECK_APP_ID`. It is public by design, so a variable is fine. Leave it unset to ship with analytics off.
4. Push to `main` (or run the workflow from the Actions tab). The workflow checks types, tests, validates the content, builds with `VITE_BASE=/detour/`, and deploys.

## Check it worked

- Open the URL on a phone. Add it to the Home Screen (iPhone: Share, then Add to Home Screen).
- Turn on airplane mode and reopen it: it should still work (the service worker caches the app, cards and images).
- In TelemetryDeck, signals such as `app.opened` should appear within a few minutes. The full list is in `web/src/analytics/signals.ts`.

## Local production preview

```bash
pnpm build
pnpm --filter web preview
```

## Notes

- Testers should Add to Home Screen so Safari doesn't clear their progress after about a week of not using it.
- Local development sends test-mode signals only, and only if `VITE_TELEMETRYDECK_APP_ID` is set in `.env.local`.
- If the repo is renamed, change `VITE_BASE` in `.github/workflows/deploy.yml`.

## Optional: feedback link

Add a repository variable `FEEDBACK_URL` (for example a Google Form, a WhatsApp group invite or a mailto: link). Settings then shows a **Send feedback** link. Re-run the deploy after adding it.
