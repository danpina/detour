# Claude Code prompt sequence — Phase 0 & 1 (local-first)

One prompt at a time. After each: run it, click through it, commit (`git commit -am "step N"`). If something breaks, describe what you see before moving on.

---

## Step 1 — Scaffold
> Read CLAUDE.md and SPEC.md. Set up the pnpm monorepo with `/content` (schema package), `/tools` (Node/TS CLI) and `/web` (Vite + React + TypeScript strict + Tailwind). Add `.env.example`, root scripts, and a README "How to run locally". No features yet. Tell me the exact commands to run and what I should see.

## Step 2 — Content schema + hand-made examples
> In /content/schema define zod schemas for the 6 card types, probes (mcq, tf, estimate, cloze), images (file, alt, kind photo|artwork|generated, credit, license, source_url) and sources, plus manifest.json. Write 2 excellent example cards per content type by hand into /content/published with real facts, real sources, and real openly licensed images (download them, record license data). Add `pnpm tools validate`.

## Step 3 — Draft + fact-check pipeline
> Build `pnpm tools draft`: input a CSV (interest, topic, angle). For each row call the Anthropic API to produce a card + probes + sources + an image brief (what to show, search keywords, real-photo-likely yes/no) as schema-valid JSON in /content/drafts. Then a second call fetches the source pages and checks each claim, saving a pass/fail report with quotes. Model name and key from env. Add --dry-run and a cost estimate.

## Step 4 — Image pipeline
> Build `pnpm tools images`: for each draft, search open-license sources from CLAUDE.md using the image brief; keep 3–5 candidates with full license metadata, rejecting disallowed licenses. If none fit, generate 2 illustrations with the configured image-generation API using a house-style prompt template I can edit in /tools/style.md. Save candidates next to the draft. Never auto-publish.

## Step 5 — Local review UI
> Build `pnpm tools review`: a small local web page (localhost only) listing drafts with their fact-check report and image candidates. I can edit text, pick an image (or set a crop), approve, or reject. Approve runs optimization (sharp, 1080×1350 max, WebP, ≤120 KB) and writes the card + image to /content/published and updates manifest.json.

## Step 6 — Web app: onboarding + card UI
> Build the web app reading /content/published at build time. Onboarding: pick ≥ 3 interests → first 5-card set. One full-screen component per card type, image-forward with a readable text scrim, swipe/tap navigation, credit "ⓘ" sheet with license and source, sources link, and "Report error". End screen: "You learned 5 things. We'll check tomorrow if they stuck." Store everything in IndexedDB via Dexie.

## Step 7 — Session engine + FSRS
> Implement the session engine from SPEC §3 (2 reviews + 2 new + 1 drill, fallbacks) with ts-fsrs and automatic rating (define time thresholds per probe kind). Add the endless free-scroll feed. Vitest tests for mix, fallbacks and rating. Also create /content/fsrs-test-vectors.json (inputs → expected schedules) for the future iOS port.

## Step 8 — Skill drills
> Rule-generated drills for mental math (levels from 2-digit addition up to percentages and multiplication tricks) and estimation (Fermi-style, log-distance scoring). Level-up at 80% over 20 attempts.

## Step 9 — Progress, streak, export
> Progress screen (remembered score, knowledge map per interest, skill levels, streak with 2 freezes/week), a weekly recap card that can be saved as an image, and Settings with "Export progress" / "Import progress" (JSON file) plus a hint to Add to Home Screen.

## Step 10 — PWA, analytics, deploy
> Make it an installable PWA with offline support (precache cards and images). Add TelemetryDeck with the anonymous signals from SPEC §8 (including report-error with card id only). Add a GitHub Actions workflow that builds and deploys /web to GitHub Pages on push to main. Give me the checklist to enable Pages and set the TelemetryDeck app id.

---

### After Step 10
Produce cards in batches (draft → images → review → publish) until ~300 are approved, share the link with 30–50 testers (ask them to Add to Home Screen), and watch retention and recall in TelemetryDeck for 2–3 weeks.
