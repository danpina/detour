// `pnpm tools sendback <sendback.json>`
// Takes the list exported from the website's reviewer mode and moves those cards out of the published set and back
// into the review queue (content/drafts), with the reason attached. The previous image stays available as a candidate.
// Cards sent back are never auto-approved again; they wait for a human in `pnpm tools review`.
import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { draftSchema } from "@detour/content";
import type { Candidate, CandidatesFile } from "./images.js";
import { DRAFTS_DIR, readJsonFile } from "./publish.js";
import { CARDS_DIR, IMAGES_DIR, writeManifest } from "./published.js";

type Item = { card_id: string; reason: string; note?: string; at?: number };

const REASON_TEXT: Record<string, string> = {
  wrong: "Wrong or misleading",
  image: "Bad or unfitting image",
  writing: "Badly written or confusing",
  boring: "Boring or low value",
  other: "Something else",
};

function parseItems(raw: unknown): Item[] {
  const items = (raw as { items?: unknown })?.items ?? raw;
  if (!Array.isArray(items)) throw new Error("Expected a send-back file with an items list.");
  return items.map((i) => {
    if (!i || typeof i.card_id !== "string" || !/^[a-z]+-\d{4}$/.test(i.card_id)) throw new Error(`Bad entry: ${JSON.stringify(i)}`);
    return { card_id: i.card_id, reason: String(i.reason ?? "other"), note: typeof i.note === "string" ? i.note : undefined, at: typeof i.at === "number" ? i.at : undefined };
  });
}

export async function sendBackCard(item: Item): Promise<string> {
  const cardFile = path.join(CARDS_DIR, `${item.card_id}.json`);
  if (!existsSync(cardFile)) return `${item.card_id}: not in the published set (already sent back?)`;
  const card = await readJsonFile(cardFile);
  const { image, review: _review, ...rest } = card as Record<string, any>;
  void _review;

  const words = String(card.title ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
  // Keep the earlier fact-check, so a card sent back only for its image does not need to be re-checked.
  const approvedDraft = path.join(DRAFTS_DIR, "_approved", `${item.card_id}.json`);
  const check = existsSync(approvedDraft) ? (await readJsonFile(approvedDraft)).check : undefined;
  const draft = {
    status: "draft" as const,
    topic: { interest: card.interest, topic: String(card.title), angle: "sent back from the published set" },
    created_at: new Date().toISOString(),
    model: "sent back from published",
    card: rest,
    ...(check ? { check } : {}),
    image_brief: {
      show: String(image?.alt ?? card.title),
      keywords: words.length ? words.slice(0, 6) : ["illustration"],
      real_photo_likely: image ? image.kind !== "generated" : true,
    },
    sent_back: {
      reason: REASON_TEXT[item.reason] ?? item.reason,
      ...(item.note ? { note: item.note } : {}),
      at: new Date(item.at ?? Date.now()).toISOString(),
    },
  };
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return `${item.card_id}: could not turn it back into a draft (${parsed.error.issues[0]?.message})`;

  await writeFile(path.join(DRAFTS_DIR, `${item.card_id}.json`), JSON.stringify(parsed.data, null, 2) + "\n");

  // Bring back the old candidate previews and keep the published image as a "previous" option.
  const imgDir = path.join(DRAFTS_DIR, `${item.card_id}.images`);
  const old = path.join(DRAFTS_DIR, "_approved", `${item.card_id}.images`);
  if (!existsSync(imgDir) && existsSync(old)) await cp(old, imgDir, { recursive: true });
  await mkdir(imgDir, { recursive: true });
  await rm(path.join(imgDir, "pick.json"), { force: true });

  if (image) {
    const published = path.join(IMAGES_DIR, image.file);
    if (existsSync(published)) {
      await copyFile(published, path.join(imgDir, "previous.webp"));
      const candFile = path.join(imgDir, "candidates.json");
      const cands: CandidatesFile = existsSync(candFile)
        ? JSON.parse((await readFile(candFile, "utf8")).replace(/^﻿/, ""))
        : { draft_id: item.card_id, created_at: new Date().toISOString(), queries: [], candidates: [], rejected: [], needs_generation: false, notes: [] };
      const previous: Candidate = {
        id: "previous",
        source: "previous",
        kind: image.kind,
        title: "Previously published image",
        credit: image.credit,
        license: image.license,
        ...(image.source_url ? { source_url: image.source_url } : {}),
        file: "previous.webp",
        alt_suggestion: image.alt,
      };
      cands.candidates = [previous, ...cands.candidates.filter((c) => c.id !== "previous")];
      await writeFile(candFile, JSON.stringify(cands, null, 2) + "\n");
    }
    await rm(path.join(IMAGES_DIR, image.file), { force: true });
  }
  await rm(cardFile, { force: true });
  return `${item.card_id}: sent back (${draft.sent_back.reason}${item.note ? `: ${item.note}` : ""})`;
}

export async function runSendBack(argv: string[]): Promise<number> {
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Usage: pnpm tools sendback <sendback.json>   (the file you export from reviewer mode on the website)");
    return 1;
  }
  const full = [path.resolve(file), path.resolve(process.cwd(), "..", file)].find((p) => existsSync(p));
  if (!full) {
    console.error(`File not found: ${file}`);
    return 1;
  }
  let items: Item[];
  try {
    items = parseItems(await readJsonFile(full));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return 1;
  }
  for (const item of items) console.log("  " + (await sendBackCard(item)));
  const manifest = await writeManifest();
  console.log(`\nManifest updated (version ${manifest.version}). Review them with: pnpm tools review`);
  return 0;
}
