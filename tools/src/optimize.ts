import sharp from "sharp";

export const OUT_W = 1080;
export const OUT_H = 1350;
export const TARGET_BYTES = 120 * 1024;

export type Crop = {
  /** Centre of the crop as a fraction of the source image (0..1). */
  fx: number;
  fy: number;
  /** 1 = the largest 4:5 region that fits; 2 = half as wide, etc. */
  zoom: number;
};

/** The 4:5 region cropped from a W x H source. Mirrored by the review UI preview. */
export function cropRect(W: number, H: number, { fx, fy, zoom }: Crop) {
  const w0 = Math.min(W, H * 0.8);
  const h0 = w0 / 0.8;
  const z = Math.max(1, zoom);
  const w = w0 / z;
  const h = h0 / z;
  const x = Math.min(Math.max(fx * W - w / 2, 0), W - w);
  const y = Math.min(Math.max(fy * H - h / 2, 0), H - h);
  return { left: Math.round(x), top: Math.round(y), width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}

/** Crops to 4:5, resizes to at most 1080x1350 (never upscales) and encodes WebP, <= 120 KB where possible. */
export async function optimizeToWebp(input: Buffer, crop: Crop = { fx: 0.5, fy: 0.5, zoom: 1 }) {
  const meta = await sharp(input).rotate().metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("could not read image size");
  const region = cropRect(W, H, crop);
  const base = sharp(input).rotate().extract(region);

  let best: { buffer: Buffer; width: number; height: number; quality: number } | undefined;
  for (const width of [Math.min(OUT_W, region.width), 960, 840, 720]) {
    if (width > Math.min(OUT_W, region.width)) continue;
    const height = Math.round((width * 5) / 4);
    for (let quality = 80; quality >= 40; quality -= 5) {
      const buffer = await base.clone().resize(width, height, { fit: "cover" }).webp({ quality, effort: 6 }).toBuffer();
      best = { buffer, width, height, quality };
      if (buffer.length <= TARGET_BYTES) return best;
    }
  }
  return best!;
}
