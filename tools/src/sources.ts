// Fetching and searching the raw text of cited source pages. Used by the fact-check agents (to quote real text)
// and by the automatic approver (to re-verify every quote against the page itself, not against anyone's summary).
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const UA = "Mozilla/5.0 (compatible; DetourContentTools/0.1; +https://github.com/danpina/detour)";
const CACHE = path.join(os.tmpdir(), "detour-source-cache");

const ENTITIES: Record<string, string> = { "&amp;": "&", "&nbsp;": " ", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">" };

/** Plain text with markup removed, entities decoded, citation markers like [12] dropped, and typographic quotes and dashes straightened. */
export function cleanText(input: string): string {
  return input
    .replace(/<(script|style|noscript|sup)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|nbsp|quot|apos|lt|gt|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\[\s*(?:\d+|[a-z]|note \d+|citation needed)\s*\]/gi, "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const fold = (s: string) => cleanText(s).toLowerCase().replace(/\s+([.,;:!?])/g, "$1");

/** True when `quote` appears, word for word, in `pageText` (ignoring case, spacing, citation markers and typographic punctuation). */
export function quoteFound(pageText: string, quote: string): boolean {
  const q = fold(quote).replace(/^["'.\s]+|["'.\s]+$/g, "");
  if (q.length < 12) return false; // too short to prove anything
  return fold(pageText).includes(q);
}

export function findSnippets(pageText: string, phrase: string, max = 4, width = 240): string[] {
  const text = cleanText(pageText);
  const lower = text.toLowerCase();
  const needle = fold(phrase);
  const out: string[] = [];
  let from = 0;
  while (out.length < max) {
    const i = lower.indexOf(needle, from);
    if (i < 0) break;
    out.push(text.slice(Math.max(0, i - width), Math.min(text.length, i + needle.length + width)));
    from = i + needle.length;
  }
  return out;
}

/** Wikipedia pages are read through the REST API, which returns the whole article as HTML. */
function sourceUrl(url: string): string {
  const m = /^https?:\/\/([a-z]+)\.wikipedia\.org\/wiki\/([^#?]+)/i.exec(url);
  return m ? `https://${m[1]}.wikipedia.org/api/rest_v1/page/html/${m[2]}` : url;
}

export type SourceText = { url: string; ok: boolean; text: string; error?: string };

export async function fetchSourceText(url: string): Promise<SourceText> {
  const key = path.join(CACHE, createHash("sha1").update(url).digest("hex") + ".txt");
  try {
    if (existsSync(key)) return { url, ok: true, text: await readFile(key, "utf8") };
    const res = await fetch(sourceUrl(url), { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { url, ok: false, text: "", error: `HTTP ${res.status}` };
    const text = cleanText(await res.text());
    await mkdir(CACHE, { recursive: true });
    await writeFile(key, text);
    return { url, ok: true, text };
  } catch (e) {
    return { url, ok: false, text: "", error: e instanceof Error ? e.message : String(e) };
  }
}

/** `pnpm tools source <url> [--find "phrase" ...] [--head N]` prints real text from a cited page, for quoting. */
export async function runSource(argv: string[]): Promise<number> {
  const url = argv.find((a) => /^https?:\/\//.test(a));
  if (!url) {
    console.error('Usage: pnpm tools source <url> [--find "phrase" ...] [--head 3000]');
    return 1;
  }
  const finds: string[] = [];
  let head = 0;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--find" && argv[i + 1]) finds.push(argv[++i]!);
    if (argv[i] === "--head" && argv[i + 1]) head = Number(argv[++i]);
  }
  const page = await fetchSourceText(url);
  if (!page.ok) {
    console.log(`COULD NOT FETCH ${url}: ${page.error}`);
    return 2;
  }
  console.log(`FETCHED ${url} (${page.text.length} characters)`);
  if (head || !finds.length) console.log(page.text.slice(0, head || 2000));
  for (const f of finds) {
    const hits = findSnippets(page.text, f);
    console.log(`\n--- "${f}": ${hits.length ? `${hits.length} match(es)` : "NOT FOUND"}`);
    hits.forEach((h, i) => console.log(`[${i + 1}] ...${h}...`));
  }
  return 0;
}
