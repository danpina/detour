// Shared by the review UI and the automatic approver: reading drafts, saving edits, rejecting, and approving
// (optimize the image, validate, write the card to content/published and update the manifest).
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { cardSchema, draftSchema, isAllowedLicense, validateImagelessCard } from "@detour/content";
import { headersFor, type Candidate, type CandidatesFile } from "./images.js";
import { optimizeToWebp, type Crop } from "./optimize.js";
import { CARDS_DIR, IMAGES_DIR, writeManifest } from "./published.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
export const DRAFTS_DIR = path.join(ROOT, "content/drafts");
const UA = "DetourContentTools/0.1 (https://github.com/danpina/detour)";

export const readJsonFile = async (file: string) => JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
export async function getDraft(id: string) {
  const draft = await readJsonFile(path.join(DRAFTS_DIR, `${id}.json`));
  const candFile = path.join(DRAFTS_DIR, `${id}.images`, "candidates.json");
  const candidates = existsSync(candFile) ? await readJsonFile(candFile) : null;
  return { draft, candidates };
}

// ---------- image fetching for approval ----------

async function getBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: headersFor(url), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Fetches the best resolution we can for a candidate (the stored preview is only ~800 px). */
async function fetchBestImage(id: string, c: Candidate): Promise<Buffer> {
  if (c.source === "generated" && c.file) return readFile(path.join(DRAFTS_DIR, `${id}.images`, c.file));
  let url = c.image_url;
  try {
    if (c.source === "wikimedia") {
      const pageid = c.id.replace("wikimedia-", "");
      const res: any = await (
        await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&pageids=${pageid}&prop=imageinfo&iiprop=url&iiurlwidth=2000`, { headers: { "User-Agent": UA } })
      ).json();
      const info = res.query?.pages?.[pageid]?.imageinfo?.[0];
      url = info?.thumburl ?? info?.url ?? url;
    } else if (c.source === "nasa") {
      const nasaId = c.id.replace("nasa-", "");
      const res: any = await (await fetch(`https://images-api.nasa.gov/asset/${encodeURIComponent(nasaId)}`, { headers: { "User-Agent": UA } })).json();
      const hrefs: string[] = (res.collection?.items ?? []).map((i: any) => String(i.href));
      url = hrefs.find((h) => /~large\.jpg$/i.test(h)) ?? hrefs.find((h) => /~orig\.jpg$/i.test(h)) ?? hrefs.find((h) => /~medium\.jpg$/i.test(h)) ?? url;
    } else if (c.source === "artic" && url) {
      url = url.replace("/full/843,/", "/full/1686,/");
    }
  } catch {
    // fall back to the preview URL
  }
  if (!url) {
    if (c.file) return readFile(path.join(DRAFTS_DIR, `${id}.images`, c.file));
    throw new Error("candidate has no image url");
  }
  return getBuffer(url);
}

// ---------- actions ----------

export type Issue = { path: string; message: string };
export class UserError extends Error {
  constructor(message: string, public issues: Issue[] = []) {
    super(message);
  }
}

export async function saveCard(id: string, card: unknown) {
  const r = validateImagelessCard(card);
  if (!r.success) {
    throw new UserError("Card does not validate", r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  if ((card as { id?: string }).id !== id) throw new UserError("Card id cannot be changed");
  const file = path.join(DRAFTS_DIR, `${id}.json`);
  const draft = await readJsonFile(file);
  draft.card = card;
  const check = draftSchema.safeParse(draft);
  if (!check.success) throw new UserError("Draft does not validate", check.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  await writeFile(file, JSON.stringify(draft, null, 2) + "\n");
}

async function moveDraft(id: string, to: "_approved" | "_rejected") {
  const dir = path.join(DRAFTS_DIR, to);
  await mkdir(dir, { recursive: true });
  await rename(path.join(DRAFTS_DIR, `${id}.json`), path.join(dir, `${id}.json`));
  const imgs = path.join(DRAFTS_DIR, `${id}.images`);
  if (existsSync(imgs)) await rename(imgs, path.join(dir, `${id}.images`));
}

export async function reject(id: string) {
  await moveDraft(id, "_rejected");
}

export type ApproveBody = {
  card: Record<string, unknown>;
  candidate_id?: string;
  crop?: Crop;
  alt?: string;
  credit?: string;
  license?: string;
  kind?: "photo" | "artwork" | "generated";
  acknowledge_flags?: boolean;
};

export async function approve(id: string, body: ApproveBody, reviewedBy: "human" | "agent" = "human") {
  const { draft, candidates } = await getDraft(id);
  if (draft.check?.overall !== "pass" && !body.acknowledge_flags) {
    throw new UserError("This draft has unchecked or flagged claims. Tick the acknowledgement box to approve anyway.");
  }
  await saveCard(id, body.card);
  const card = body.card as Record<string, any>;

  let image: Record<string, unknown> | undefined;
  let webp: Buffer | undefined;
  if (card.type !== "drill" && card.type !== "recall") {
    const cand = (candidates as CandidatesFile | null)?.candidates.find((c) => c.id === body.candidate_id);
    if (!cand) throw new UserError("Pick an image first");
    const alt = (body.alt ?? cand.alt_suggestion ?? "").trim();
    const credit = (body.credit ?? cand.credit).trim();
    const license = (body.license ?? cand.license).trim();
    const kind = body.kind ?? cand.kind;
    if (kind !== "generated" && !isAllowedLicense(license)) throw new UserError(`License not allowed: "${license}"`);
    const out = await optimizeToWebp(await fetchBestImage(id, cand), body.crop);
    webp = out.buffer;
    image = {
      file: `${id}.webp`,
      alt,
      kind,
      credit: kind === "generated" ? "Illustration" : credit,
      license: kind === "generated" ? "Generated" : license,
      ...(cand.source_url ? { source_url: cand.source_url } : {}),
    };
  }

  const published = { ...card, review: { by: reviewedBy, at: new Date().toISOString() }, ...(image ? { image } : {}) };
  const parsed = cardSchema.safeParse(published);
  if (!parsed.success) {
    throw new UserError("Published card would not validate", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  if (webp) {
    await mkdir(IMAGES_DIR, { recursive: true });
    await writeFile(path.join(IMAGES_DIR, `${id}.webp`), webp);
  }
  await writeFile(path.join(CARDS_DIR, `${id}.json`), JSON.stringify(parsed.data, null, 2) + "\n");
  await moveDraft(id, "_approved");
  const manifest = await writeManifest();
  return { published: id, manifest_version: manifest.version, image_kb: webp ? Math.round(webp.length / 1024) : 0 };
}

