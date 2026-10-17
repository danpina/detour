import { useState, type ReactNode } from "react";
import type { Card, CardImage } from "@detour/content";
import { imageUrl } from "../lib/content";
import { track } from "../analytics";
import { store } from "../lib/db";
import { Sheet } from "./Sheet";

const REPORT_REASONS = [
  ["wrong_fact", "Something here is wrong"],
  ["unclear", "It's confusing"],
  ["bad_image", "The image doesn't fit"],
  ["other", "Something else"],
] as const;

type Props = {
  card: Card;
  index: number;
  total: number;
  /** Extra darkening, e.g. when reading long text over the image. */
  dim?: boolean;
  children: ReactNode;
};

/** Full-screen frame: image background, readable scrims, progress, credit / sources / report actions. */
export function CardShell({ card, index, total, dim, children }: Props) {
  const [sheet, setSheet] = useState<null | "credit" | "sources" | "report">(null);
  const [reported, setReported] = useState(false);
  const image: CardImage | undefined = "image" in card ? card.image : undefined;
  const url = image ? imageUrl(image.file) : undefined;

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-950 text-white">
      {url && <img src={url} alt={image!.alt} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${dim ? "opacity-55" : "opacity-0"}`} />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex gap-1" aria-label={`Card ${index + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i < index ? "bg-white" : i === index ? "bg-white/90" : "bg-white/30"}`} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-white/80">
          <span className="rounded-full bg-black/40 px-2.5 py-1 backdrop-blur">{labelFor(card)}</span>
          <div className="flex gap-2">
            <button onClick={() => setSheet("sources")} className="rounded-full bg-black/40 px-3 py-1 backdrop-blur hover:bg-black/60">
              Sources
            </button>
            <button onClick={() => setSheet("report")} className="rounded-full bg-black/40 px-3 py-1 backdrop-blur hover:bg-black/60" aria-label="Report an error">
              Report
            </button>
          </div>
        </div>
      </div>

      {children}

      {image && (
        <button
          onClick={() => setSheet("credit")}
          aria-label="Image credit and license"
          className="absolute bottom-[max(0.9rem,env(safe-area-inset-bottom))] right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm text-white/90 backdrop-blur hover:bg-black/70"
        >
          ⓘ
        </button>
      )}

      {sheet === "credit" && image && (
        <Sheet title="Image credit" onClose={() => setSheet(null)}>
          <dl className="space-y-2 text-sm">
            <Row k="Credit" v={image.kind === "generated" ? "Illustration" : image.credit} />
            <Row k="License" v={image.license} />
            <Row k="Type" v={image.kind === "generated" ? "Generated illustration" : image.kind === "artwork" ? "Artwork" : "Photo"} />
          </dl>
          {image.source_url && (
            <a className="mt-4 inline-block text-teal-600 underline dark:text-teal-300" href={image.source_url} target="_blank" rel="noreferrer">
              View original
            </a>
          )}
        </Sheet>
      )}

      {sheet === "sources" && (
        <Sheet title="Where this comes from" onClose={() => setSheet(null)}>
          <ul className="space-y-3 text-sm">
            {card.sources.map((s) => (
              <li key={s.url}>
                <a className="text-teal-600 underline dark:text-teal-300" href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {sheet === "report" && (
        <Sheet title="Spotted a problem?" onClose={() => setSheet(null)}>
          {reported ? (
            <p className="text-sm">Thanks. We'll take a look.</p>
          ) : (
            <div className="space-y-2">
              <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">Pick the closest one. Nothing else is sent.</p>
              {REPORT_REASONS.map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => {
                    void store.addEvent({ card_id: card.id, event: "report", ms_spent: 0, reason: code });
                    track("card.reported", { card: card.id, reason: code });
                    setReported(true);
                  }}
                  className="block w-full rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-neutral-500">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function labelFor(card: Card): string {
  switch (card.type) {
    case "story": return "Story";
    case "fact_why": return "Fact + why";
    case "guess_first": return "Guess first";
    case "estimate": return "Estimate";
    case "drill": return "Drill";
    case "recall": return "Quick recall";
  }
}
