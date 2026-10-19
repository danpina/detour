// `pnpm --filter tools exec tsx src/make-icons.ts` writes the placeholder app icons into web/public.
// The artwork is a simple "detour" arrow on teal; replace the SVG below (or the PNGs) when real branding exists.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve(import.meta.dirname, "../../web/public");

/** `scale` shrinks the artwork toward the centre (maskable icons need a safe zone). */
const svg = (rounded: boolean, scale = 1) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#0b2a3a"/></linearGradient></defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="url(#g)"/>
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="52" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 380 V 270 Q 150 170 250 170 H 330"/>
    <path d="M300 112 L 370 170 L 300 228" fill="#fff" stroke-width="40"/>
  </g>
</svg>`;

async function png(file: string, size: number, rounded: boolean, scale = 1) {
  await sharp(Buffer.from(svg(rounded, scale))).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(OUT, file));
}

await mkdir(path.join(OUT, "icons"), { recursive: true });
await writeFile(path.join(OUT, "favicon.svg"), svg(true));
await png("icons/icon-192.png", 192, true);
await png("icons/icon-512.png", 512, true);
await png("icons/maskable-512.png", 512, false, 0.72);
await png("icons/apple-touch-icon.png", 180, false, 0.9);
// iOS app icon: 1024x1024, square, and no transparency (App Store requirement).
const IOS_ICON = path.resolve(import.meta.dirname, "../../ios/Resources/Assets.xcassets/AppIcon.appiconset");
await mkdir(IOS_ICON, { recursive: true });
await sharp(Buffer.from(svg(false, 0.9))).resize(1024, 1024).flatten({ background: "#0f766e" }).removeAlpha().png({ compressionLevel: 9 }).toFile(path.join(IOS_ICON, "AppIcon-1024.png"));
console.log("Icons written to web/public and ios/Resources");
