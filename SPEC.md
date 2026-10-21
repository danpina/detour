# Detour — Product Spec v0.2 (local-first)

Oct 17, 2026 · Daniel · ("Detour" is a working name)

## 1. Vision & positioning

Detour turns the reflex of opening TikTok, Instagram, YouTube or any other time-wasting app into 60 seconds of learning that you actually remember. Monetized side project, English-only at launch, web prototype first, then a native iOS app (SwiftUI).

**One-line pitch:** *Your scroll habit, rerouted into a skill.*

**Problem.** Adults lose 1–2 hours a day to feeds they don't value. Learning apps need willpower to open; blockers only take something away.

**Target user (v1).** Adults 20–50 who feel guilty about screen time and like to learn. Not kids yet.

**Two pillars:**

1. **The hook:** Detour guards the apps you choose. Opening one shows a short Detour session first.
2. **The memory engine:** cards come back later as quick recall tests; skill tracks show measurable progress.

| Competitor type | Examples | What they lack |
| --- | --- | --- |
| Learning feeds | Nibble, Imprint, Headway | No habit interception; little retention loop |
| Interactive courses | Brilliant, Duolingo | Need intent; feel like homework |
| Screen-time blockers | Opal, one sec | Replace the scroll with nothing |

**Architecture principle: local-first.** All content ships inside the app; all user progress stays on the device (iCloud backup on iOS). No backend, no user accounts, no personal data on our side. The only runtime service is privacy-friendly anonymous analytics.

## 2. The hook: guarded apps

**Guarded apps** = whichever apps (or categories, or websites) the user picks in setup with Apple's picker. Nothing is deleted or permanently blocked: opening a guarded app shows a Detour screen first (the *shield*), and after a short session the app opens normally for a while.

| Mode | What happens when you open a guarded app | Who it suits |
| --- | --- | --- |
| Gentle | 1–3 cards, then "Continue" is always available | People who want a nudge |
| **Earn it (default)** | Finish a set (5 cards, ~90 s) to unlock a time block (e.g. 15 min); then the shield returns | Most users |
| Hard lock | Earn it + a daily allowance; after it, guarded apps stay shielded for the day | Strong discipline |

Settings: which apps, active hours, unlock length, set size, **one emergency skip per day**. The user can change or turn everything off anytime.

**iOS parts (one app, four parts inside it):**

| Part | Apple name | Job |
| --- | --- | --- |
| Main app | — | Cards, sessions, progress, settings |
| Shield screen | Shield Configuration extension | Designs the screen over the guarded app ("Quick one? 3 cards due") |
| Shield buttons | Shield Action extension | "Start session" → notification that opens Detour; "Skip (1 left)" → lifts shield |
| Activity monitor | DeviceActivity Monitor extension | Re-shields when unlocked time ends; active hours; midnight skip reset; Hard-lock allowance |

All parts share an App Group container (settings, due counts, debug log). Detour picks apps through Apple’s picker and stores them as anonymous tokens. The shield screen can read the name and bundle ID of the app it is covering; Detour keeps that in the App Group on the device only, so that after a guarded session it can offer “Go back to <app>” (a URL-scheme open). Nothing leaves the device.

**Flow (Earn it):**

```
Open guarded app ──> Shield ("Quick one?") ──> 5-card session ──> Unlock 15 min ──> The app (time-boxed)
                       │                                                               │
                       └──> Emergency skip (1/day; Gentle: always) ──> straight through ┘
                  ^                                                                    │
                  └──────────────────── timer ends: shield returns ───────────────────┘
```

**Apple gate:** the Family Controls *distribution* entitlement is needed for TestFlight/App Store. Low rejection risk, slow wait: submit during phase 1 (checklist §6). Fallback: iOS Shortcuts automation ("When [chosen app] opens → open Detour").

## 3. The memory engine

- **Each card carries probes** (1–2 recall questions: mcq, true/false, estimate, cloze). The probe comes back later, not the card.
- **Scheduling: FSRS** (`ts-fsrs` on web, a Swift port on iOS; must produce identical schedules). Automatic rating: right + fast = Easy, right + slow = Good, wrong = Again.
- **Session mix (5 cards):** 2 due reviews + 2 new + 1 skill drill; new cards fill empty review slots.
- **Skill tracks:** mental math and estimation at launch (rule-generated drills, infinite content); level-up at 80% over 20 attempts.
- **Progress:** remembered score, knowledge map per interest, skill levels, streak with freezes, time rerouted (iOS, on-device report view only).

All of this is computed and stored on the device.

## 4. Content: cards, images & pipeline

Launch: 6 card types, 6 interests (History, Science, Money & Markets, Tech, Human Mind, Numbers & Logic), ~300 cards for phase 1, ~600 for launch.

| Card type | Format | Time |
| --- | --- | --- |
| Story | 3–5 swipeable panels with a twist, image on first panel | 45–60 s |
| Fact + why | Surprising claim over a full-bleed image, tap to reveal why | 15–20 s |
| Guess first | Question before answer (images can be the question: "Which is older?") | 10–15 s |
| Estimate | Slider answer scored by closeness | 15 s |
| Drill | Timed skill exercise (rule-generated, no image needed) | 30–60 s |
| Recall | A probe resurfaced by FSRS (reuses the card's image as a thumbnail cue) | 5–10 s |

### Images

Every content card (story, fact, guess, estimate) has one strong image. Order of preference:

1. **Real, openly licensed images** (preferred for history, science, nature, art): Wikimedia Commons (public domain / CC0 / CC BY / CC BY-SA), NASA & ESA (public domain / CC BY), museum open-access collections (Met, Rijksmuseum, Smithsonian, Art Institute of Chicago — CC0), Library of Congress (public domain), Unsplash and Pexels (their own free licenses) for generic photos.
2. **Generated illustrations** when no fitting real image exists (abstract concepts, psychology, finance ideas, "what if" scenarios).

Rules:

- Store license + credit + source URL with every real image; show a small credit ("ⓘ") on the card. CC BY-SA images: keep the image unmodified apart from resizing/cropping and credit the license.
- **Generated images are illustrations, never fake evidence:** one consistent house style (e.g. editorial illustration, flat colors), never photorealistic depictions of real people, real historical events or scientific results. They are labeled "Illustration" in the credit.
- No images of identifiable living private persons; no brand logos.
- Format: 1080 × 1350 (4:5) max, WebP for web, HEIC/WebP for iOS, target ≤ 120 KB each → ~300 cards ≈ 35 MB bundled. If the bundle grows too large, later card packs are downloaded as static files (see §7).
- Every image has alt text (accessibility).

### Pipeline (runs on your computer, never in the app)

1. **Topics file:** interest + topic + angle (curated by you).
2. **Draft:** the Anthropic API writes card + probes + 2–3 sources as JSON matching the schema, plus an *image brief* (what the image should show, search keywords, whether a real photo should exist).
3. **Fact check:** a second pass fetches sources and checks each claim → pass/fail report.
4. **Image search:** query the open-license sources above with the brief; collect 3–5 candidates with license metadata; reject non-commercial or no-derivatives licenses and unclear licenses.
5. **Image generation (fallback):** if no candidate fits, generate 2 options in the house style with an image-generation API.
6. **Review (you):** a local review tool shows card + check report + image candidates; you edit, pick an image, approve/reject (~2 min/card).
7. **Optimize & publish:** approved images are resized/compressed, card JSON is validated, and both are written to `/content/published`, which both apps bundle.

Cards are data, not code. "Report error" in the app sends an anonymous analytics event with the card id (no free text), so you can review flagged cards.

## 5. Key user flows

1. **First open (~60 s, no account ever):** pick 3+ interests → first 5-card set → "You learned 5 things. We'll check tomorrow if they stuck." → (iOS) "Want Detour to guard your time-wasting apps?" → pick apps + mode → notification permission ("your daily recall check").
2. **Guarded open (iOS):** flow in §2.
3. **Free scroll:** opening Detour directly = endless feed with the same mix.
4. **Progress screen** and **weekly recap** (shareable image).
5. **Backup:** iOS progress syncs automatically through the user's iCloud; web progress lives in the browser (testers should "Add to Home Screen" so Safari doesn't clear it after ~7 days of no use).

## 6. MVP scope & phases

1. **Phase 0 — Content seed (2–3 weeks).** Schema, pipeline with images, review tool, first 300 approved cards, 2 skill tracks.
2. **Phase 1 — Web prototype / PWA (4–6 weeks).** Static site (GitHub Pages), all card types, FSRS, progress, local storage, anonymous analytics. 30–50 testers.
   - *In parallel:* name + domain, one-page site with privacy policy, Apple Developer Program, register app + 3 extension IDs, submit Family Controls request.
   - *Gate to phase 2:* D7 retention ≥ 25%, average recall ≥ 70%, ≥ half of testers want the hook.
3. **Phase 2 — Native iOS (6–10 weeks).** SwiftUI, built and signed in the cloud via your GitHub pipeline (macOS runners). Same `/content/published` bundle. SwiftData + CloudKit, Screen Time parts, notifications, StoreKit 2. Development builds installed over the air on registered test iPhones until the distribution entitlement is granted, then TestFlight. In-app debug log screen (extensions write to the App Group).
   - *Gate to phase 3:* beta users average 3+ guarded sessions/day in week 2.
4. **Phase 3 — Launch & monetize.** App Store, paywall, 600+ cards, regular content updates.
5. **Phase 4 — Expand.** Spanish & German, more tracks, Android, Family mode.

**Apple approval checklist:**

- [ ] Individual authorization only; described as "self-control and digital wellbeing: the user picks which apps to shield and can change or remove it anytime."
- [ ] Privacy: Apple's picker, anonymous tokens, no Screen Time data leaves the device. (Local-first makes this easy: we store no personal data at all.)
- [ ] Website + privacy policy live on the final domain.
- [ ] All 4 IDs listed: app + shield, shield-action, activity-monitor extensions.
- [ ] Account Holder submits; keep the case number.
- [ ] Short demo video of the dev build.

**Avoid in v1:** watching/controlling anyone else's phone; uploading usage data; ad SDKs; locks the user can't undo; kids/family mentions; other companies' app names or logos in the app name, keywords or screenshots.

**Out of MVP:** accounts, social features, user-generated content, kids, Android, non-English, on-the-fly AI content.

## 7. Tech architecture (local-first)

| Layer | Choice |
| --- | --- |
| Content source of truth | `/content/published`: `cards/*.json` + `images/*` + `manifest.json` (version, card list, checksums) |
| Web (phase 1) | Vite + React + TypeScript + Tailwind, PWA (vite-plugin-pwa), static build on GitHub Pages |
| Web storage | IndexedDB via Dexie (reviews, events, settings, streak) + export/import progress as a file |
| iOS (phase 2) | SwiftUI, SwiftData with CloudKit sync, Screen Time extensions, StoreKit 2 |
| Spaced repetition | `ts-fsrs` (web), Swift FSRS port (iOS); shared test vectors guarantee identical schedules |
| Analytics | TelemetryDeck (privacy-first, EU), anonymous signals only; web + Swift SDKs |
| Content tools (local) | Node/TS scripts: Anthropic API (drafts, checks), open-license image search, image-generation API (fallback), sharp (image optimization), local review UI |
| Later content packs | Optional: extra packs as static files on GitHub Pages, downloaded and cached by the app |

**Local data model (both apps):**

| Store | Key fields |
| --- | --- |
| `settings` | interests[], mode, set_size, unlock_minutes, active_hours, onboarding_done |
| `reviews` | probe_id, due_at, stability, difficulty, reps, lapses, state, last_review_at |
| `events` | card_id, event (view/complete/skip/report), ms_spent, at (kept locally, max ~90 days) |
| `sessions` | started_at, source (guarded/free), cards_done, unlock_granted_min |
| `skill_progress` | track_id, level, recent_results[] |
| `streak` | current, best, freezes_left, last_active_day |
| `entitlement` | plus (bool, from StoreKit) |

**Card JSON (sketch):**

```json
{
  "id": "hist-0042",
  "interest": "history",
  "type": "fact_why",
  "title": "Oxford is older than the Aztec Empire",
  "body": { "claim": "...", "why": "..." },
  "image": {
    "file": "hist-0042.webp",
    "alt": "Medieval stone buildings of Oxford",
    "kind": "photo",
    "credit": "Photographer Name / Wikimedia Commons",
    "license": "CC BY-SA 4.0",
    "source_url": "https://commons.wikimedia.org/wiki/File:..."
  },
  "probes": [{ "id": "hist-0042-p1", "kind": "tf", "question": "...", "answer": true }],
  "sources": [{ "title": "...", "url": "..." }],
  "difficulty": 2,
  "version": 1
}
```

## 8. Monetization & metrics

Freemium, no ads. Hook + reviews always free.

| | Free | Detour Plus |
| --- | --- | --- |
| Hook on guarded apps, 3 modes | Yes | Yes |
| Reviews | Always | Always |
| New cards/day | 15 | Unlimited |
| Skill tracks | 1 | All |
| Progress | Basic | Full map, history, weekly deep recap |
| Price (to test) | €0 | €5.99/month or €39.99/year, 7-day trial (StoreKit 2, no third-party service) |

Metrics (anonymous, TelemetryDeck): D1/D7/D30 retention (45/25/12%), sessions per active day (≥ 3), recall rate (70–85%), paywall → trial (≥ 10%), trial → paid (≥ 35%), cards reported per 1,000 views.

## 9. Risks & open questions

| Risk | Mitigation |
| --- | --- |
| Hook feels like punishment | Modes, emergency skip, short sets, warm tone |
| Content or image quality | Human review of every card and image; sources and credits shown |
| Image licensing mistakes | Only allow-listed licenses; store license metadata; reject unclear ones |
| Generated images mislead | Illustration style only, labeled, never photoreal real people/events |
| App size grows | WebP/HEIC ≤ 120 KB; static content packs later |
| Content updates need app releases | Acceptable at first; static packs later |
| Web progress lost | Add to Home Screen; export/import file; it's only the prototype |
| Apple entitlement wait | Submit in phase 1; dev builds meanwhile; Shortcuts fallback |
| Crowded market | Position on hook + memory |

Open: final name/domain; image-generation provider and house style; reviewer capacity; partners; legal entity before charging.
