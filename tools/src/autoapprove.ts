// `pnpm tools autoapprove [--approve] [--id sci-0001]`
// Approves drafts that pass a strict, mostly mechanical test, so a human only has to look at the rest.
// Without --approve it only reports what it WOULD do. Every approval is stamped review.by = "agent".
//
// A draft is auto-approved only when ALL of these hold:
//  1. It validates, and its independent fact-check report says "pass" with every source fetched.
//  2. The card was not edited after the check ran.
//  3. Every claim has a verbatim quote, and that quote is found word for word in the cited page when we fetch it
//     again here (claims proven by arithmetic are allowed to say so instead of quoting).
//  4. Every claim cites one of the card's own sources.
//  5. An image agent looked at the candidates and recorded a fitting pick (pick.json) with an allowed license.
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { draftSchema, isAllowedLicense } from "@detour/content";
import type { CandidatesFile } from "./images.js";
import { DRAFTS_DIR, approve, readJsonFile } from "./publish.js";
import { fetchSourceText, quoteFound } from "./sources.js";

type Pick = { candidate_id: string; alt: string; fits: boolean; note?: string; crop?: { fx: number; fy: number; zoom: number } };

export type Decision = { id: string; title: string; ok: boolean; reasons: string[]; pick?: Pick };

const CALC = /calculat|arithmetic|computed|by definition/i;

export async function judgeDraft(id: string): Promise<Decision> {
  const reasons: string[] = [];
  const file = path.join(DRAFTS_DIR, `${id}.json`);
  const raw = await readJsonFile(file);
  const title: string = raw?.card?.title ?? id;
  const done = (pick?: Pick): Decision => ({ id, title, ok: reasons.length === 0, reasons, pick });

  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    reasons.push("draft does not validate");
    return done();
  }
  const draft = parsed.data;
  const check = draft.check;
  if (!check) {
    reasons.push("no fact-check report yet");
    return done();
  }
  if (check.overall !== "pass") reasons.push("fact-check did not fully pass");
  for (const s of check.sources) if (!s.fetched) reasons.push(`source not fetched: ${s.url}`);

  const modified = (await stat(file)).mtimeMs;
  if (modified > new Date(check.checked_at).getTime() + 5_000) reasons.push("card was edited after the fact-check ran");

  const cardSources = new Set(((draft.card.sources ?? []) as { url: string }[]).map((s) => s.url));
  for (const u of cardSources) if (!check.sources.some((s) => s.url === u)) reasons.push(`a card source was never checked: ${u}`);
  if (check.claims.length === 0) reasons.push("the report lists no claims");

  // Re-verify each quote against the real page text.
  for (const [i, c] of check.claims.entries()) {
    const label = `claim ${i + 1}`;
    if (c.verdict !== "pass") {
      reasons.push(`${label} is ${c.verdict}: ${c.claim.slice(0, 80)}`);
      continue;
    }
    if (!c.quote) {
      if (!CALC.test(c.note ?? "")) reasons.push(`${label} has no quote and is not marked as arithmetic: ${c.claim.slice(0, 80)}`);
      continue;
    }
    if (!c.source_url || !cardSources.has(c.source_url)) {
      reasons.push(`${label} cites a page that is not one of the card's sources`);
      continue;
    }
    const page = await fetchSourceText(c.source_url);
    if (!page.ok) reasons.push(`${label}: could not re-fetch ${c.source_url} (${page.error})`);
    else if (!quoteFound(page.text, c.quote)) reasons.push(`${label}: quote not found word for word on the page: "${c.quote.slice(0, 70)}"`);
  }

  // Image decision (not needed for drills).
  if (draft.card.type !== "drill" && draft.card.type !== "recall") {
    const pickFile = path.join(DRAFTS_DIR, `${id}.images`, "pick.json");
    const candFile = path.join(DRAFTS_DIR, `${id}.images`, "candidates.json");
    if (!existsSync(pickFile) || !existsSync(candFile)) {
      reasons.push("no image decision yet");
      return done();
    }
    const pick = (await readJsonFile(pickFile)) as Pick;
    const cands = (await readJsonFile(candFile)) as CandidatesFile;
    const cand = cands.candidates.find((c) => c.id === pick.candidate_id);
    if (!pick.fits) reasons.push(`image agent: no candidate fits${pick.note ? ` (${pick.note})` : ""}`);
    else if (!cand) reasons.push("image pick refers to a candidate that does not exist");
    else {
      if (cand.kind !== "generated" && !isAllowedLicense(cand.license)) reasons.push(`image license not allowed: ${cand.license}`);
      if ((pick.alt ?? "").trim().length < 15) reasons.push("image alt text is too short to be useful");
    }
    return done(pick);
  }
  return done();
}

export async function runAutoApprove(argv: string[]): Promise<number> {
  const doApprove = argv.includes("--approve");
  const onlyIdx = argv.indexOf("--id");
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : undefined;
  const ids = (await readdir(DRAFTS_DIR))
    .filter((f) => /^[a-z]+-\d{4}\.json$/.test(f))
    .map((f) => f.replace(".json", ""))
    .filter((id) => !only || id === only)
    .sort();

  let approved = 0;
  const manual: Decision[] = [];
  for (const id of ids) {
    const d = await judgeDraft(id);
    if (!d.ok) {
      manual.push(d);
      continue;
    }
    if (!doApprove) {
      console.log(`  would approve  ${id}  ${d.title}`);
      approved++;
      continue;
    }
    try {
      const raw = await readJsonFile(path.join(DRAFTS_DIR, `${id}.json`));
      const pick = d.pick;
      await approve(id, { card: raw.card, candidate_id: pick?.candidate_id, alt: pick?.alt, crop: pick?.crop }, "agent");
      console.log(`  approved       ${id}  ${d.title}`);
      approved++;
    } catch (e) {
      manual.push({ ...d, ok: false, reasons: [`approval failed: ${e instanceof Error ? e.message : e}`] });
    }
  }

  console.log(`\n${doApprove ? "Approved" : "Would approve"} ${approved} of ${ids.length}. ${manual.length} need a human:`);
  for (const m of manual) {
    console.log(`  ${m.id}  ${m.title}`);
    m.reasons.slice(0, 4).forEach((r) => console.log(`      - ${r}`));
  }
  return 0;
}
