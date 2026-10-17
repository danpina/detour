// `pnpm tools images --pending [--id hist-0003] [--limit N] [--dry-run] [--generate]`
// For each draft: search open-license sources using its image brief, keep 3-5 candidates with full license
// metadata (rejecting disallowed licenses), and if none fit (or the brief says an illustration is needed)
// generate 2 illustrations in the house style (tools/style.md). Candidates are saved next to the draft in
// content/drafts/<id>.images/. Nothing is ever published from here.
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { draftSchema, isAllowedLicense, type Draft } from "@detour/content";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DRAFTS_DIR = path.join(ROOT, "content/drafts");
const UA = "DetourContentTools/0.1 (https://github.com/danpina/detour)";
const MAX_CANDIDATES = 5;

export type Candidate = {
  id: string;
  source: "wikimedia" | "nasa" | "met" | "artic" | "unsplash" | "pexels" | "generated";
  kind: "photo" | "artwork" | "generated";
  title: string;
  credit: string;
  license: string;
  source_url?: string;
  /** Remote image used for the downloaded preview. */
  image_url?: string;
  width?: number;
  height?: number;
  /** Preview file name inside the .images folder. */
  file?: string;
  alt_suggestion?: string;
};
type Rejected = { source: string; title: string; license: string; reason: string };
export type CandidatesFile = {
  draft_id: string;
  created_at: string;
  queries: string[];
  candidates: Candidate[];
  rejected: Rejected[];
  needs_generation: boolean;
  notes: string[];
};

// ---------- helpers ----------

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}

const strip = (s: unknown) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

async function getJson<T = any>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 80)}`);
  return (await res.json()) as T;
}

/** Normalises the many ways sources spell licenses to the strings our schema allows. */
export function normalizeLicense(raw: string): string {
  const s = raw.trim();
  if (/^(public domain|pd\b|pd-|cc0|cc 0|no known copyright)/i.test(s) || /public domain/i.test(s)) {
    return /cc0/i.test(s) ? "CC0" : "Public domain";
  }
  const m = /^cc[ -]by([ -]sa)?[ -](\d\.\d)/i.exec(s);
  if (m && !/-nc|-nd|nc-|nd-/i.test(s)) return `CC BY${m[1] ? "-SA" : ""} ${m[2]}`;
  return s;
}

// ---------- sources ----------

type Found = { candidates: Candidate[]; rejected: Rejected[] };

async function searchWikimedia(q: string): Promise<Found> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12" +
    "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=800&gsrsearch=" +
    encodeURIComponent(`${q} filetype:bitmap`);
  const res = await getJson(url);
  const out: Found = { candidates: [], rejected: [] };
  for (const page of Object.values<any>(res.query?.pages ?? {}).sort((a, b) => a.index - b.index)) {
    const info = page.imageinfo?.[0];
    if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
    if (info.width < 900 || info.height < 700) continue;
    const meta = info.extmetadata ?? {};
    const rawLicense = strip(meta.LicenseShortName?.value);
    const license = normalizeLicense(rawLicense);
    const title = strip(page.title).replace(/^File:/, "");
    if (!isAllowedLicense(license)) {
      out.rejected.push({ source: "wikimedia", title, license: rawLicense || "unknown", reason: "license not allowed" });
      continue;
    }
    const artist = strip(meta.Artist?.value);
    out.candidates.push({
      id: `wikimedia-${page.pageid}`,
      source: "wikimedia",
      kind: /painting|drawing|engraving|etching|illustration|lithograph|poster|portrait by/i.test(strip(meta.ImageDescription?.value) + title) ? "artwork" : "photo",
      title,
      credit: `${artist && !/unknown/i.test(artist) ? artist : strip(meta.Credit?.value) || "Unknown author"} / Wikimedia Commons`.slice(0, 160),
      license,
      source_url: info.descriptionurl,
      image_url: info.thumburl,
      width: info.width,
      height: info.height,
      alt_suggestion: strip(meta.ImageDescription?.value).slice(0, 200) || title,
    });
  }
  return out;
}

async function searchNasa(q: string): Promise<Found> {
  const res = await getJson(`https://images-api.nasa.gov/search?media_type=image&page_size=10&q=${encodeURIComponent(q)}`);
  const out: Found = { candidates: [], rejected: [] };
  for (const item of res.collection?.items ?? []) {
    const d = item.data?.[0];
    const link = item.links?.find((l: any) => l.render === "image");
    if (!d || !link) continue;
    out.candidates.push({
      id: `nasa-${d.nasa_id}`,
      source: "nasa",
      kind: "photo",
      title: strip(d.title),
      credit: `${strip(d.secondary_creator || d.photographer || d.center || "NASA")} / NASA`,
      license: "Public domain",
      source_url: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
      image_url: link.href,
      alt_suggestion: strip(d.description).slice(0, 200) || strip(d.title),
    });
  }
  return out;
}

async function searchMet(q: string): Promise<Found> {
  const base = "https://collectionapi.metmuseum.org/public/collection/v1";
  const res = await getJson(`${base}/search?hasImages=true&isPublicDomain=true&q=${encodeURIComponent(q)}`);
  const out: Found = { candidates: [], rejected: [] };
  for (const id of (res.objectIDs ?? []).slice(0, 4)) {
    const o = await getJson(`${base}/objects/${id}`);
    if (!o.isPublicDomain || !o.primaryImageSmall) continue;
    out.candidates.push({
      id: `met-${id}`,
      source: "met",
      kind: "artwork",
      title: strip(o.title),
      credit: `${strip(o.artistDisplayName) || "Unknown artist"} / The Metropolitan Museum of Art`,
      license: "CC0",
      source_url: o.objectURL,
      image_url: o.primaryImageSmall,
      alt_suggestion: `${strip(o.title)}${o.objectDate ? `, ${strip(o.objectDate)}` : ""}`,
    });
  }
  return out;
}

async function searchArtic(q: string): Promise<Found> {
  const res = await getJson(
    `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&query[term][is_public_domain]=true&limit=6&fields=id,title,artist_display,image_id,date_display,thumbnail`,
  );
  const out: Found = { candidates: [], rejected: [] };
  for (const a of res.data ?? []) {
    if (!a.image_id) continue;
    out.candidates.push({
      id: `artic-${a.id}`,
      source: "artic",
      kind: "artwork",
      title: strip(a.title),
      credit: `${strip(a.artist_display).split("\n")[0] || "Unknown artist"} / Art Institute of Chicago`,
      license: "CC0",
      source_url: `https://www.artic.edu/artworks/${a.id}`,
      image_url: `https://www.artic.edu/iiif/2/${a.image_id}/full/843,/0/default.jpg`,
      alt_suggestion: strip(a.thumbnail?.alt_text) || strip(a.title),
    });
  }
  return out;
}

async function searchUnsplash(q: string): Promise<Found> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return { candidates: [], rejected: [] };
  const res = await getJson(`https://api.unsplash.com/search/photos?per_page=5&orientation=portrait&query=${encodeURIComponent(q)}`, {
    Authorization: `Client-ID ${key}`,
  });
  return {
    rejected: [],
    candidates: (res.results ?? []).map((p: any) => ({
      id: `unsplash-${p.id}`,
      source: "unsplash" as const,
      kind: "photo" as const,
      title: strip(p.description || p.alt_description || "Unsplash photo"),
      credit: `${strip(p.user?.name)} / Unsplash`,
      license: "Unsplash License",
      source_url: p.links?.html,
      image_url: p.urls?.regular,
      width: p.width,
      height: p.height,
      alt_suggestion: strip(p.alt_description),
    })),
  };
}

async function searchPexels(q: string): Promise<Found> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return { candidates: [], rejected: [] };
  const res = await getJson(`https://api.pexels.com/v1/search?per_page=5&orientation=portrait&query=${encodeURIComponent(q)}`, { Authorization: key });
  return {
    rejected: [],
    candidates: (res.photos ?? []).map((p: any) => ({
      id: `pexels-${p.id}`,
      source: "pexels" as const,
      kind: "photo" as const,
      title: strip(p.alt || "Pexels photo"),
      credit: `${strip(p.photographer)} / Pexels`,
      license: "Pexels License",
      source_url: p.url,
      image_url: p.src?.large,
      width: p.width,
      height: p.height,
      alt_suggestion: strip(p.alt),
    })),
  };
}

const SOURCES: { name: string; run: (q: string) => Promise<Found> }[] = [
  { name: "wikimedia", run: searchWikimedia },
  { name: "nasa", run: searchNasa },
  { name: "met", run: searchMet },
  { name: "artic", run: searchArtic },
  { name: "unsplash", run: searchUnsplash },
  { name: "pexels", run: searchPexels },
];

// ---------- generation ----------

async function generateIllustrations(show: string, count: number, dir: string, notes: string[]): Promise<Candidate[]> {
  const provider = process.env.IMAGE_GEN_PROVIDER;
  const key = process.env.IMAGE_GEN_API_KEY;
  const model = process.env.IMAGE_GEN_MODEL;
  if (!provider || !key || !model) {
    notes.push("Image generation not configured (IMAGE_GEN_PROVIDER / IMAGE_GEN_API_KEY / IMAGE_GEN_MODEL); skipped.");
    return [];
  }
  const style = await readFile(path.join(ROOT, "tools/style.md"), "utf8");
  const template = /## Prompt template\s+([\s\S]*)$/.exec(style)?.[1]?.trim() ?? "{{show}}";
  const prompt = template.replace("{{show}}", show);

  const buffers: Buffer[] = [];
  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, n: count, size: "1024x1536" }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      for (const d of json.data ?? []) if (d.b64_json) buffers.push(Buffer.from(d.b64_json, "base64"));
    } else if (provider === "google") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: count, aspectRatio: "3:4" } }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`Google HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      for (const p of json.predictions ?? []) if (p.bytesBase64Encoded) buffers.push(Buffer.from(p.bytesBase64Encoded, "base64"));
    } else {
      notes.push(`Unknown IMAGE_GEN_PROVIDER "${provider}" (use openai or google).`);
      return [];
    }
  } catch (e) {
    notes.push(`Image generation failed: ${e instanceof Error ? e.message : e}`);
    return [];
  }

  const out: Candidate[] = [];
  for (const [i, buf] of buffers.entries()) {
    const file = `gen-${i + 1}.png`;
    await writeFile(path.join(dir, file), buf);
    out.push({
      id: `generated-${i + 1}`,
      source: "generated",
      kind: "generated",
      title: `Generated illustration ${i + 1}`,
      credit: "Illustration",
      license: "Generated",
      file,
      alt_suggestion: show,
    });
  }
  return out;
}

// ---------- per-draft work ----------

/** Museum and NASA searches are fuzzy; keep only results whose text mentions a brief keyword. */
function relevant(c: Candidate, draft: Draft): boolean {
  if (c.source === "wikimedia" || c.source === "unsplash" || c.source === "pexels") return true;
  const text = `${c.title} ${c.alt_suggestion ?? ""}`.toLowerCase();
  const words = [...draft.image_brief.keywords, draft.topic.topic]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  return words.some((w) => text.includes(w));
}

function queriesFor(draft: Draft): string[] {
  const k = draft.image_brief.keywords;
  const qs = [k.slice(0, 3).join(" "), k[0] ?? "", k.slice(0, 2).join(" ")].map((s) => s.trim()).filter(Boolean);
  return [...new Set(qs)];
}

async function downloadPreview(c: Candidate, dir: string, n: number): Promise<void> {
  if (!c.image_url) return;
  try {
    const res = await fetch(c.image_url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const file = `cand-${n}.jpg`;
    await writeFile(path.join(dir, file), Buffer.from(await res.arrayBuffer()));
    c.file = file;
  } catch {
    // keep the candidate without a preview; the review UI can load image_url directly
  }
}

async function processDraft(draft: Draft, id: string, opts: { generate: boolean; dryRun: boolean }): Promise<CandidatesFile> {
  const queries = queriesFor(draft);
  const result: CandidatesFile = {
    draft_id: id,
    created_at: new Date().toISOString(),
    queries,
    candidates: [],
    rejected: [],
    needs_generation: false,
    notes: [],
  };
  const dir = path.join(DRAFTS_DIR, `${id}.images`);
  const preferGenerated = !draft.image_brief.real_photo_likely;

  if (!preferGenerated || opts.generate === false) {
    const seen = new Set<string>();
    const perSource = new Map<string, Candidate[]>();
    for (const q of queries) {
      if ([...perSource.values()].flat().length >= MAX_CANDIDATES * 2) break;
      const runs = await Promise.allSettled(SOURCES.map((s) => s.run(q)));
      runs.forEach((r, i) => {
        const name = SOURCES[i]!.name;
        if (r.status === "rejected") {
          const note = `${name} failed for "${q}": ${r.reason instanceof Error ? r.reason.message : r.reason}`;
          if (!result.notes.includes(note)) result.notes.push(note);
          return;
        }
        result.rejected.push(...r.value.rejected);
        for (const c of r.value.candidates) {
          if (seen.has(c.id) || !relevant(c, draft)) continue;
          seen.add(c.id);
          const list = perSource.get(name) ?? [];
          if (list.length < 3) perSource.set(name, [...list, c]);
        }
      });
    }
    // Round-robin across sources so the reviewer sees variety, Commons first.
    const lists = SOURCES.map((s) => perSource.get(s.name) ?? []);
    for (let i = 0; i < 3 && result.candidates.length < MAX_CANDIDATES; i++) {
      for (const l of lists) if (l[i] && result.candidates.length < MAX_CANDIDATES) result.candidates.push(l[i]!);
    }
  }

  result.needs_generation = result.candidates.length === 0;
  if (opts.dryRun) return result;

  await mkdir(dir, { recursive: true });
  await Promise.all(result.candidates.map((c, i) => downloadPreview(c, dir, i + 1)));
  if (result.needs_generation || opts.generate) {
    const gens = await generateIllustrations(draft.image_brief.show, 2, dir, result.notes);
    result.candidates.push(...gens);
    if (gens.length) result.needs_generation = false;
  }
  await writeFile(path.join(dir, "candidates.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}

// ---------- entry ----------

export async function runImages(argv: string[]): Promise<number> {
  loadEnv();
  const flag = (n: string) => argv.includes(`--${n}`);
  const val = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const only = val("id");
  const limit = val("limit") ? Number(val("limit")) : Infinity;
  if (!only && !flag("pending")) {
    console.error("Usage: pnpm tools images --pending | --id <draft-id>  [--limit N] [--dry-run] [--generate]");
    return 1;
  }

  const files = (await readdir(DRAFTS_DIR)).filter((f) => /^[a-z]+-\d{4}\.json$/.test(f)).sort();
  let done = 0;
  for (const f of files) {
    const id = f.replace(".json", "");
    if (only && id !== only) continue;
    if (!only && existsSync(path.join(DRAFTS_DIR, `${id}.images`, "candidates.json"))) continue;
    if (done >= limit) break;

    const parsed = draftSchema.safeParse(JSON.parse((await readFile(path.join(DRAFTS_DIR, f), "utf8")).replace(/^﻿/, "")));
    if (!parsed.success) {
      console.log(`${id}: skipped, invalid draft`);
      continue;
    }
    if (parsed.data.card.type === "drill" || parsed.data.card.type === "recall") continue;

    process.stdout.write(`${id} ${parsed.data.card.title ?? ""} … `);
    const r = await processDraft(parsed.data, id, { generate: flag("generate"), dryRun: flag("dry-run") });
    const bySource = Object.entries(
      r.candidates.reduce<Record<string, number>>((a, c) => ((a[c.source] = (a[c.source] ?? 0) + 1), a), {}),
    )
      .map(([s, n]) => `${s}:${n}`)
      .join(" ");
    console.log(
      `${r.candidates.length} candidates (${bySource || "none"})${r.rejected.length ? `, ${r.rejected.length} rejected for license` : ""}${
        r.needs_generation ? ", needs generation" : ""
      }${flag("dry-run") ? " [dry run]" : ""}`,
    );
    if (flag("dry-run")) console.log(`    queries: ${r.queries.map((q) => `"${q}"`).join(", ")}`);
    r.notes.forEach((n) => console.log(`    note: ${n}`));
    done++;
  }
  console.log(done ? `Done. Candidates are in content/drafts/<id>.images/ (not published).` : "Nothing pending.");
  return 0;
}
