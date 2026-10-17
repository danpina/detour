import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { cardSchema, manifestSchema, type Card, type Manifest } from "@detour/content";

export const PUBLISHED_DIR = path.resolve(import.meta.dirname, "../../content/published");
export const CARDS_DIR = path.join(PUBLISHED_DIR, "cards");
export const IMAGES_DIR = path.join(PUBLISHED_DIR, "images");
export const MANIFEST_PATH = path.join(PUBLISHED_DIR, "manifest.json");

export const MAX_IMAGE_BYTES = 150 * 1024; // hard limit; the target is 120 KB
export const TARGET_IMAGE_BYTES = 120 * 1024;

export const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

/** Reads a JSON file, tolerating a UTF-8 BOM. */
export async function readJson(file: string): Promise<unknown> {
  return JSON.parse((await readFile(file, "utf8")).replace(/^﻿/, ""));
}

export type LoadedCard = { file: string; raw: unknown; card?: Card; issues: string[] };

export async function loadCards(): Promise<LoadedCard[]> {
  const files = (await readdir(CARDS_DIR)).filter((f) => f.endsWith(".json")).sort();
  const out: LoadedCard[] = [];
  for (const file of files) {
    const raw = await readJson(path.join(CARDS_DIR, file));
    const parsed = cardSchema.safeParse(raw);
    out.push({
      file,
      raw,
      card: parsed.success ? parsed.data : undefined,
      issues: parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".") || "(card)"}: ${i.message}`),
    });
  }
  return out;
}

export async function buildManifest(cards: Card[], version: number): Promise<Manifest> {
  const manifest: Manifest = { version, generated_at: new Date().toISOString(), cards: [], images: [] };
  for (const card of cards) {
    const file = `cards/${card.id}.json`;
    manifest.cards.push({ id: card.id, file, sha256: sha256(await readFile(path.join(PUBLISHED_DIR, file))) });
    if ("image" in card) {
      const buf = await readFile(path.join(IMAGES_DIR, card.image.file));
      manifest.images.push({ file: `images/${card.image.file}`, sha256: sha256(buf), bytes: buf.length });
    }
  }
  return manifestSchema.parse(manifest);
}

/** Rebuilds manifest.json from every valid published card and bumps its version. */
export async function writeManifest(): Promise<Manifest> {
  const cards = (await loadCards()).flatMap((l) => (l.card ? [l.card] : []));
  let version = 0;
  try {
    const prev = manifestSchema.safeParse(await readJson(MANIFEST_PATH));
    if (prev.success) version = prev.data.version;
  } catch {
    // no manifest yet
  }
  const manifest = await buildManifest(cards, version + 1);
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

export async function fileSize(file: string): Promise<number | undefined> {
  try {
    return (await stat(file)).size;
  } catch {
    return undefined;
  }
}
