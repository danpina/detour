// One-off helper for Step 2: downloads the hand-picked Wikimedia Commons images,
// optimizes them (1080x1350 max, WebP, <=120 KB) and prints their license metadata.
// Usage: pnpm --filter tools exec tsx src/fetch-example-images.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UA = "DetourContentTools/0.1 (https://github.com/danpina/detour)";
const OUT = path.resolve(import.meta.dirname, "../../content/published/images");

const PICKS: Record<string, string> = {
  "hist-0001": "File:Radcliffe Camera Oxford 2018 04.jpg",
  "sci-0001": "File:Venus globe.jpg",
  "hist-0002": "File:All Gizah Pyramids.jpg",
  "sci-0002": "File:View through an old growth forest with young trees growing in the sunlight between the hugh old Douglas fir trees.... - NARA - 557627.jpg",
  "sci-0003": "File:A human skeleton, seen from the front, resting the bones of Wellcome V0007798.jpg",
  "sci-0004": "File:The Blue Marble (remastered).jpg",
  "money-0001": "File:Semper Augustus - Six Collection.jpg",
  "tech-0001": "File:Ada Lovelace portrait.jpg",
};

const strip = (s: string | undefined) => (s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function main() {
  await mkdir(OUT, { recursive: true });
  const report: Record<string, unknown> = {};
  for (const [id, title] of Object.entries(PICKS)) {
    const api =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=2000&titles=" +
      encodeURIComponent(title);
    const res = (await (await fetch(api, { headers: { "User-Agent": UA } })).json()) as any;
    const page = Object.values(res.query.pages)[0] as any;
    const info = page.imageinfo[0];
    const meta = info.extmetadata;
    const img = Buffer.from(await (await fetch(info.thumburl, { headers: { "User-Agent": UA } })).arrayBuffer());

    // Step quality down first, then shrink dimensions, until the file is <= 120 KB.
    let quality = 80;
    let out = Buffer.alloc(0);
    search: for (const width of [1080, 960, 840]) {
      for (quality = 80; quality >= 40; quality -= 5) {
        out = await sharp(img)
          .resize(width, Math.round((width * 5) / 4), { fit: "cover", position: sharp.strategy.attention })
          .webp({ quality, effort: 6 })
          .toBuffer();
        if (out.length <= 120 * 1024) break search;
      }
    }
    await writeFile(path.join(OUT, `${id}.webp`), out);
    report[id] = {
      file: `${id}.webp`,
      bytes: out.length,
      quality,
      license: strip(meta.LicenseShortName?.value),
      artist: strip(meta.Artist?.value),
      credit: strip(meta.Credit?.value),
      source_url: info.descriptionurl,
    };
  }
  console.log(JSON.stringify(report, null, 2));
}

main();
