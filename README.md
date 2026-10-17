# Detour

Your scroll habit, rerouted into a skill. Local-first: content is bundled, progress stays on the device. See `SPEC.md` and `CLAUDE.md`.

## How to run locally

Requirements: Node 22+, pnpm.

```bash
pnpm install
pnpm dev          # web app at http://localhost:5173
pnpm tools        # content CLI (stubs until Steps 2-5)
pnpm typecheck    # all packages
pnpm test         # all packages
pnpm build        # production build of /web into web/dist
```

Copy `.env.example` to `.env.local` when a step asks for API keys (used only by `/tools`).

## Layout

- `content/schema` — zod schemas (Step 2)
- `content/drafts` — pipeline output, unreviewed
- `content/published` — approved cards, images, `manifest.json`
- `tools` — local Node/TS CLI
- `web` — Vite + React + Tailwind app
