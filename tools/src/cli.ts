import { writeFile } from "node:fs/promises";
import { manifestSchema } from "@detour/content";
import {
  IMAGES_DIR,
  MANIFEST_PATH,
  MAX_IMAGE_BYTES,
  TARGET_IMAGE_BYTES,
  buildManifest,
  fileSize,
  loadCards,
  readJson,
} from "./published.js";
import path from "node:path";
import { runDraft } from "./draft.js";
import { runImages } from "./images.js";

const [command] = process.argv.slice(2);
const planned = ["review", "publish"];

async function validate(): Promise<number> {
  const loaded = await loadCards();
  let errors = 0;
  const fail = (where: string, msg: string) => {
    errors++;
    console.error(`  ✗ ${where}: ${msg}`);
  };
  const seenIds = new Set<string>();
  const seenProbes = new Set<string>();

  for (const { file, card, issues } of loaded) {
    if (!card) {
      issues.forEach((i) => fail(file, i));
      continue;
    }
    if (file !== `${card.id}.json`) fail(file, `file name must be ${card.id}.json`);
    if (seenIds.has(card.id)) fail(file, `duplicate card id ${card.id}`);
    seenIds.add(card.id);
    for (const p of card.probes) {
      if (seenProbes.has(p.id)) fail(file, `duplicate probe id ${p.id}`);
      seenProbes.add(p.id);
    }
    if ("image" in card) {
      const size = await fileSize(path.join(IMAGES_DIR, card.image.file));
      if (size === undefined) fail(file, `image file missing: ${card.image.file}`);
      else if (size > MAX_IMAGE_BYTES) fail(file, `image too large: ${(size / 1024).toFixed(0)} KB (max 150)`);
      else if (size > TARGET_IMAGE_BYTES) console.warn(`  ! ${file}: image ${(size / 1024).toFixed(0)} KB is over the 120 KB target`);
    }
  }

  const manifest = manifestSchema.safeParse(await readJson(MANIFEST_PATH));
  if (!manifest.success) {
    fail("manifest.json", manifest.error.issues.map((i) => i.message).join("; "));
  } else {
    const listed = new Set(manifest.data.cards.map((c) => c.id));
    for (const id of seenIds) if (!listed.has(id)) fail("manifest.json", `missing card ${id} (run: pnpm tools manifest)`);
    for (const id of listed) if (!seenIds.has(id)) fail("manifest.json", `lists unknown card ${id}`);
    const valid = loaded.flatMap((l) => (l.card ? [l.card] : []));
    if (errors === 0) {
      const fresh = await buildManifest(valid, manifest.data.version);
      const stale = fresh.cards.some((c) => manifest.data.cards.find((m) => m.id === c.id)?.sha256 !== c.sha256);
      if (stale) fail("manifest.json", "checksums out of date (run: pnpm tools manifest)");
    }
  }

  const byType: Record<string, number> = {};
  loaded.forEach((l) => l.card && (byType[l.card.type] = (byType[l.card.type] ?? 0) + 1));
  console.log(`${loaded.length} cards checked`, byType);
  console.log(errors === 0 ? "✓ all published content is valid" : `${errors} problem(s) found`);
  return errors === 0 ? 0 : 1;
}

async function manifest(): Promise<number> {
  const loaded = await loadCards();
  const bad = loaded.filter((l) => !l.card);
  if (bad.length) {
    console.error("Fix invalid cards first (pnpm tools validate).");
    return 1;
  }
  const previous = manifestSchema.safeParse(await readJson(MANIFEST_PATH));
  const version = (previous.success ? previous.data.version : 0) + 1;
  const m = await buildManifest(loaded.map((l) => l.card!), version);
  await writeFile(MANIFEST_PATH, JSON.stringify(m, null, 2) + "\n");
  console.log(`manifest.json written: version ${version}, ${m.cards.length} cards, ${m.images.length} images`);
  return 0;
}

switch (command) {
  case "validate":
    process.exitCode = await validate();
    break;
  case "manifest":
    process.exitCode = await manifest();
    break;
  case "draft":
    process.exitCode = await runDraft(process.argv.slice(3));
    break;
  case "images":
    process.exitCode = await runImages(process.argv.slice(3));
    break;
  default:
    if (command && planned.includes(command)) {
      console.log(`"${command}" is not implemented yet (see PROMPTS.md).`);
    } else {
      console.log("Detour tools\nUsage: pnpm tools <validate|manifest|draft|images|review|publish>");
    }
}
