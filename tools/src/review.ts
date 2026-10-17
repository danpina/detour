// `pnpm tools review [--port 4173]`
// Local review UI (bound to 127.0.0.1 only). Lists drafts with their fact-check report and image candidates.
// You can edit text, pick an image and crop, then approve (optimize + publish) or reject.
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { cardSchema, draftSchema, isAllowedLicense, validateImagelessCard } from "@detour/content";
import type { Candidate, CandidatesFile } from "./images.js";
import { optimizeToWebp, type Crop } from "./optimize.js";
import { CARDS_DIR, IMAGES_DIR, loadCards, writeManifest } from "./published.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DRAFTS_DIR = path.join(ROOT, "content/drafts");
const UA = "DetourContentTools/0.1 (https://github.com/danpina/detour)";

const readJsonFile = async (file: string) => JSON.parse((await readFile(file, "utf8")).replace(/^﻿/, ""));
const isId = (s: string) => /^[a-z]+-\d{4}$/.test(s);

// ---------- data access ----------

async function listDrafts() {
  const out: unknown[] = [];
  for (const f of (await readdir(DRAFTS_DIR)).filter((f) => /^[a-z]+-\d{4}\.json$/.test(f)).sort()) {
    const id = f.replace(".json", "");
    try {
      const d = await readJsonFile(path.join(DRAFTS_DIR, f));
      const cand = existsSync(path.join(DRAFTS_DIR, `${id}.images`, "candidates.json"))
        ? ((await readJsonFile(path.join(DRAFTS_DIR, `${id}.images`, "candidates.json"))) as CandidatesFile)
        : undefined;
      out.push({
        id,
        title: d.card?.title,
        type: d.card?.type,
        interest: d.card?.interest,
        check: d.check?.overall ?? "none",
        candidates: cand?.candidates.length ?? 0,
        needs_image: d.card?.type !== "drill" && d.card?.type !== "recall",
      });
    } catch {
      out.push({ id, title: "(unreadable draft)", check: "none", candidates: 0 });
    }
  }
  return out;
}

async function stats() {
  const published = (await loadCards()).length;
  const sub = async (d: string) => (existsSync(path.join(DRAFTS_DIR, d)) ? (await readdir(DRAFTS_DIR + "/" + d)).filter((f) => f.endsWith(".json")).length : 0);
  const byInterest: Record<string, number> = {};
  for (const l of await loadCards()) if (l.card) byInterest[l.card.interest] = (byInterest[l.card.interest] ?? 0) + 1;
  return { published, rejected: await sub("_rejected"), byInterest };
}

async function getDraft(id: string) {
  const draft = await readJsonFile(path.join(DRAFTS_DIR, `${id}.json`));
  const candFile = path.join(DRAFTS_DIR, `${id}.images`, "candidates.json");
  const candidates = existsSync(candFile) ? await readJsonFile(candFile) : null;
  return { draft, candidates };
}

// ---------- image fetching for approval ----------

async function getBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
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

type Issue = { path: string; message: string };
class UserError extends Error {
  constructor(message: string, public issues: Issue[] = []) {
    super(message);
  }
}

async function saveCard(id: string, card: unknown) {
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

async function reject(id: string) {
  await moveDraft(id, "_rejected");
}

type ApproveBody = {
  card: Record<string, unknown>;
  candidate_id?: string;
  crop?: Crop;
  alt?: string;
  credit?: string;
  license?: string;
  kind?: "photo" | "artwork" | "generated";
  acknowledge_flags?: boolean;
};

async function approve(id: string, body: ApproveBody) {
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

  const published = { ...card, ...(image ? { image } : {}) };
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

// ---------- http ----------

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function send(res: http.ServerResponse, status: number, body: unknown, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : (body as Buffer | string));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 2_000_000) throw new UserError("Body too large");
    chunks.push(c as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export async function runReview(argv: string[]): Promise<number> {
  const pi = argv.indexOf("--port");
  const port = pi >= 0 ? Number(argv[pi + 1]) : 4173;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const html = await readFile(path.join(import.meta.dirname, "review-ui.html"), "utf8");

  const server = http.createServer(async (req, res) => {
    try {
      // Localhost-only hardening: refuse foreign Host headers (DNS rebinding) and cross-origin writes.
      if (!allowedHosts.has(req.headers.host ?? "")) return send(res, 403, { error: "forbidden host" });
      const origin = req.headers.origin;
      if (req.method !== "GET" && origin && !allowedHosts.has(new URL(origin).host)) return send(res, 403, { error: "forbidden origin" });

      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const parts = url.pathname.split("/").filter(Boolean);

      if (req.method === "GET" && url.pathname === "/") return send(res, 200, html, "text/html; charset=utf-8");
      if (req.method === "GET" && url.pathname === "/api/drafts") return send(res, 200, { drafts: await listDrafts(), stats: await stats() });

      if (parts[0] === "api" && parts[1] === "drafts" && parts[2] && isId(parts[2])) {
        const id = parts[2];
        if (!existsSync(path.join(DRAFTS_DIR, `${id}.json`))) return send(res, 404, { error: "no such draft" });
        if (req.method === "GET" && parts.length === 3) return send(res, 200, await getDraft(id));
        if (req.method === "GET" && parts[3] === "preview" && parts[4]) {
          const file = path.basename(parts[4]);
          const full = path.join(DRAFTS_DIR, `${id}.images`, file);
          if (!existsSync(full)) return send(res, 404, { error: "no preview" });
          return send(res, 200, await readFile(full), MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
        }
        if (req.method === "PUT" && parts.length === 3) {
          await saveCard(id, (await readBody(req)).card);
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && parts[3] === "reject") {
          await reject(id);
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && parts[3] === "approve") return send(res, 200, await approve(id, await readBody(req)));
      }
      send(res, 404, { error: "not found" });
    } catch (e) {
      if (e instanceof UserError) return send(res, 400, { error: e.message, issues: e.issues });
      console.error(e);
      send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(`Review UI running at http://localhost:${port}  (Ctrl+C to stop)`);
  await new Promise(() => {});
  return 0;
}
