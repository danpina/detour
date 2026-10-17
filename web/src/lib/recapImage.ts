import type { Recap } from "./progress";

/** Draws the weekly recap as a 1080x1350 PNG (4:5), ready to save or share. */
export async function renderRecapImage(recap: Recap): Promise<Blob> {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f3d3a");
  bg.addColorStop(0.6, "#0b1f2a");
  bg.addColorStop(1, "#050810");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const font = (size: number, weight = 600) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const text = (s: string, x: number, y: number, size: number, color = "#ffffff", weight = 600, align: CanvasTextAlign = "left") => {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };

  text("Detour", 90, 140, 44, "#5eead4");
  text("My week", 90, 270, 110);
  text("of learning", 90, 390, 110);

  const rows: [string, string][] = [
    [String(recap.cards), recap.cards === 1 ? "card learned or recalled" : "cards learned or recalled"],
    [recap.recallRate === null ? "–" : `${Math.round(recap.recallRate * 100)}%`, "recalled"],
    [recap.minutes < 1 ? "<1 min" : `${recap.minutes} min`, "of focused learning"],
    [`${recap.streak}`, "day streak"],
  ];
  rows.forEach(([big, small], i) => {
    const y = 610 + i * 185;
    text(big, 90, y, 110, "#ffffff", 700);
    text(small, 90, y + 62, 40, "rgba(255,255,255,0.7)", 500);
  });

  text("Your scroll habit, rerouted into a skill.", W / 2, H - 80, 38, "rgba(255,255,255,0.75)", 500, "center");

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image"))), "image/png"));
}

/** Uses the share sheet when the device can share files, otherwise downloads the PNG. */
export async function saveRecapImage(recap: Recap): Promise<"shared" | "downloaded"> {
  const blob = await renderRecapImage(recap);
  const file = new File([blob], "detour-week.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "My week on Detour" });
      return "shared";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "detour-week.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
