# Agent review protocol

Drafts are checked by independent agents, and the ones that pass a strict test are approved automatically
(`pnpm tools autoapprove --approve`). Anything that does not pass goes to the human queue (`pnpm tools review`).
Approved cards are stamped `review: { by: "agent", at: ... }` so they can be audited later.

## What "pass" means (enforced by code, not by trust)

A draft is auto-approved only when all of this is true:

1. The fact-check report in the draft says `pass`, every cited source was fetched, and every claim passed.
2. The card was not edited after the report was written.
3. Every claim has a **verbatim quote**, and `pnpm tools autoapprove` re-fetches the cited page and finds that quote
   word for word. Claims that are pure arithmetic may skip the quote if their note says they were verified by calculation.
4. Every claim cites one of the card's own sources.
5. The image agent looked at the candidate images and wrote `pick.json` with a fitting image and descriptive alt text.

## Fact-check agent

Works from the repo root (`C:\Workspace\detour`). For each draft it is given:

1. Read `content/drafts/<id>.json` and list every distinct factual claim: title, body text, reveal, probe questions
   AND probe answers.
2. For each claim, get real text from the cited page with the tool, never from memory or a summary:
   `pnpm tools source "<url>" --find "<distinctive words from the claim>"`
   It prints the matching passages of the page. Copy the supporting sentence **exactly** as the quote
   (at least 12 characters, at most about 25 words, no ellipses, no paraphrase).
3. Verdicts: `pass` (the quote clearly supports the claim), `fail` (the page contradicts it), `unverified` (the page
   neither supports nor contradicts it, or could not be fetched). Be strict about numbers, dates, names and words
   like "first", "about", "most".
4. Pure arithmetic (powers, products, conversions, probabilities) is verified by calculation. Put
   `Verified by calculation: ...` in `note` and omit the quote.
5. Write the `check` field into the draft (see `CheckReport` in `content/schema/index.ts`):
   `{ checked_at: <ISO time>, model: "independent agent", sources: [{url, fetched, error?}], claims: [{claim, verdict, source_url?, quote?, note?}], overall }`
   with `overall: "pass"` only if every claim passed and every source was fetched. Do not edit the card.
6. Report, per card, each non-passing claim and a corrected wording that the page would support.

## Image agent

For each draft, read the card and its `image_brief`, then open `content/drafts/<id>.images/candidates.json` and **look at**
the preview images (`cand-1.jpg`, ...) before choosing. Write `content/drafts/<id>.images/pick.json`:

```json
{ "candidate_id": "wikimedia-123", "alt": "One descriptive sentence of what the image shows", "fits": true, "note": "why" }
```

An image fits only if it plausibly illustrates the card's subject and would not mislead: no unrelated stock imagery,
no identifiable private individuals, no logos or brands, nothing sensitive, and it must look good as a full-screen
4:5 card background. If nothing fits, write `"fits": false` with a note and a `candidate_id` of `""`.
Optionally add `"crop": { "fx": 0.5, "fy": 0.4, "zoom": 1 }` (centre of the crop, 0 to 1) to keep the subject in frame.
