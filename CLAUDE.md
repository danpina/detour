# CLAUDE.md â€” Detour

Read `SPEC.md` before any task. It is the source of truth. If a request conflicts with it, say so before coding.

## Project
- Detour: a learning app that guards the user's time-wasting apps with short card sessions and trains memory with spaced repetition.
- **Local-first:** content is bundled; user progress stays on the device. No backend, no accounts, no database server.
- Current phase: **0â€“1** (content tools + web prototype). No iOS code yet.

## Repo layout
- `/content/schema` â€” zod schemas for cards, probes, images (shared by tools and web app)
- `/content/drafts` â€” pipeline output, not yet reviewed (gitignored images allowed to be large)
- `/content/published` â€” approved cards (`cards/*.json`), optimized images (`images/*`), `manifest.json`. The ONLY content the apps read.
- `/tools` â€” local Node/TS scripts: draft, fact-check, image search, image generation, optimize, publish, review UI
- `/web` â€” Vite + React + TypeScript + Tailwind PWA
- `/ios` - SwiftUI app (XcodeGen project, built in CI on macOS runners; no local Mac)

## Stack
- TypeScript strict everywhere, pnpm workspaces.
- Web: Vite, React, Tailwind, vite-plugin-pwa, Dexie (IndexedDB), ts-fsrs, TelemetryDeck web SDK.
- Tools: Anthropic API (drafting, fact-checking), open-license image APIs (Wikimedia Commons, NASA, Met/Rijksmuseum/Smithsonian/AIC open access, Unsplash, Pexels), one image-generation API (provider set in env), sharp for optimization.
- Tests: Vitest for logic; Playwright for 1â€“2 smoke flows.
- Deploy: static build to GitHub Pages via GitHub Actions.

## Rules
1. Cards are data. Every card in `/content/published` validates against the schema, has â‰¥ 1 probe, â‰¥ 1 source URL, and (except drills) exactly one image with alt text, credit, license and source URL.
2. Image licenses: allow only public domain, CC0, CC BY, CC BY-SA, Unsplash License, Pexels License. Reject NC, ND, unknown. Generated images get `kind: "generated"`, credit "Illustration", and must follow the house style; never photorealistic images of real people or real historical/scientific events.
3. Images published at max 1080Ã—1350, WebP, target â‰¤ 120 KB.
4. No personal data anywhere: no accounts, no emails, no free-text analytics. Analytics signals are anonymous and listed in `/web/src/analytics/signals.ts`.
5. Secrets (API keys) only in `.env.local`, used only by `/tools`. The web app needs no secrets except the public TelemetryDeck app id.
6. Mobile-first UI for a 390 px wide screen; one card per screen; swipe/tap; dark mode; image-forward design with readable text over images (gradient scrims).
7. Wrap every storage read/write in try/catch; the app must work if storage is empty.
8. Small, reviewable steps: after each task, list what changed, how to run it, how to test it.
9. Warm, short UI copy ("Quick one?"), never guilt.

## Commands (keep updated)
- `pnpm install`
- `pnpm tools validate` — check all published cards, images and the manifest
- `pnpm tools manifest` — regenerate manifest.json after changing published content
- `pnpm tools draft --topics topics/history.csv` â€” draft cards
- `pnpm tools images --pending` â€” find/generate images for drafts
- `pnpm tools review` â€” open local review UI
- `pnpm tools publish` â€” optimize + validate + write to /content/published
- `pnpm --filter web dev` â€” web app at http://localhost:5173
- `pnpm --filter web test`
- `pnpm --filter web e2e` - Playwright smoke tests (set `PW_CHANNEL=msedge` locally to reuse Edge)
