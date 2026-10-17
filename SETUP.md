# Detour — Setup steps (local-first)

## A. Install the tools (one time, ~30 min)

- Git — https://git-scm.com
- Node.js LTS (v22+) — https://nodejs.org
- pnpm — run `corepack enable` then `corepack prepare pnpm@latest --activate`
- Claude Code — https://docs.claude.com/en/docs/claude-code

Check: `git --version`, `node -v`, `pnpm -v`, `claude --version`.
(No Docker, no database tools needed.)

## B. Create the project (~10 min)

1. On GitHub create a **private** repo `detour` under your account.
2. `git clone https://github.com/<you>/detour.git` and `cd detour`
3. Copy the kit files into the repo root: `SPEC.md`, `CLAUDE.md`, `PROMPTS.md`, `SETUP.md`, `.env.example`, `.gitignore`.
4. `git add . && git commit -m "spec and setup" && git push`

## C. Keys and accounts — what you need when

| When | What | Cost | Used for |
| --- | --- | --- | --- |
| Step 3 | Anthropic API key (console.anthropic.com) | Pay per use, a few € per 100 cards | Drafting + fact-checking cards |
| Step 4 | Image-generation API key (one provider, e.g. OpenAI images or Google Imagen) | A few cents per image; only fallback images | Illustrations when no real image fits |
| Step 4 | Unsplash + Pexels API keys (free developer accounts) | €0 | Searching free photos (Wikimedia, NASA and museums need no key) |
| Step 10 | TelemetryDeck account (telemetrydeck.com) | Free tier | Anonymous retention + recall numbers |
| Step 10 | GitHub Pages (in your repo settings) | €0 | Hosting the web prototype |
| Phase 1, in parallel | Domain + one-page site with privacy policy | ~€10–15/year | Apple requirement, final name |
| Phase 1, in parallel | Apple Developer Program | $99/year | App IDs + Family Controls request |
| Phase 2 | Your existing GitHub cloud-build pipeline | As for your other apps | Building and signing the iOS app |

No Supabase, Vercel or other backend at all.

## D. Start building

1. In the repo folder run `claude`.
2. Paste **Step 1** from PROMPTS.md, follow its instructions, check, commit.
3. Continue step by step. Put API keys in `.env.local` when a step asks for them (never in `.env.example`).
4. Step 2 creates the first hand-made example cards: spend time on them — they set the quality bar and the visual style.

## E. Apple, in parallel during phase 1

1. Choose the final name, buy the domain.
2. Publish a one-page site with a privacy policy (Claude Code can generate it; with local-first it says "we store no personal data").
3. Join the Apple Developer Program, register the app ID + 3 extension IDs, submit the Family Controls request (checklist in SPEC.md §6).
