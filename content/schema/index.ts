import { z } from "zod";

export const CONTENT_SCHEMA_VERSION = 1;

export const INTERESTS = ["history", "science", "money", "tech", "mind", "numbers"] as const;
export const interestSchema = z.enum(INTERESTS);
export type Interest = z.infer<typeof interestSchema>;

// ---------- Sources ----------

export const sourceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
});
export type Source = z.infer<typeof sourceSchema>;

// ---------- Images ----------

/** CLAUDE.md rule 2: public domain, CC0, CC BY, CC BY-SA, Unsplash, Pexels. No NC, ND or unknown. */
const ALLOWED_LICENSE =
  /^(Public domain|CC0( 1\.0)?|CC BY( \d\.\d)?|CC BY-SA( \d\.\d)?|Unsplash License|Pexels License)$/;

export const imageSchema = z
  .object({
    file: z.string().regex(/^[a-z0-9-]+\.webp$/, "image file must be a lowercase .webp name"),
    alt: z.string().min(5),
    kind: z.enum(["photo", "artwork", "generated"]),
    credit: z.string().min(1),
    license: z.string().min(1),
    source_url: z.url().optional(),
  })
  .superRefine((img, ctx) => {
    if (img.kind === "generated") {
      if (img.credit !== "Illustration") {
        ctx.addIssue({ code: "custom", path: ["credit"], message: 'generated images must have credit "Illustration"' });
      }
      return;
    }
    if (!ALLOWED_LICENSE.test(img.license)) {
      ctx.addIssue({ code: "custom", path: ["license"], message: `license not allowed: "${img.license}"` });
    }
    if (!img.source_url) {
      ctx.addIssue({ code: "custom", path: ["source_url"], message: "real images need a source_url" });
    }
  });
export type CardImage = z.infer<typeof imageSchema>;

// ---------- Probes ----------

const probeBase = { id: z.string().regex(/^[a-z]+-\d{4}-p\d$/), question: z.string().min(5) };

export const mcqProbeSchema = z
  .object({
    ...probeBase,
    kind: z.literal("mcq"),
    options: z.array(z.string().min(1)).min(2).max(5),
    answer: z.number().int().min(0),
  })
  .refine((p) => p.answer < p.options.length, { path: ["answer"], message: "answer index out of range" });

export const tfProbeSchema = z.object({ ...probeBase, kind: z.literal("tf"), answer: z.boolean() });

export const estimateProbeSchema = z
  .object({
    ...probeBase,
    kind: z.literal("estimate"),
    answer: z.number(),
    unit: z.string(),
    min: z.number(),
    max: z.number(),
    scale: z.enum(["linear", "log"]).default("linear"),
  })
  .refine((p) => p.min < p.max && p.answer >= p.min && p.answer <= p.max, {
    path: ["answer"],
    message: "answer must lie within min..max",
  })
  .refine((p) => p.scale === "linear" || p.min > 0, { path: ["min"], message: "log scale needs min > 0" });

export const clozeProbeSchema = z.object({
  ...probeBase,
  kind: z.literal("cloze"),
  /** Question text containing "____" where the answer goes. */
  question: z.string().includes("____", { message: 'cloze question needs a "____" blank' }),
  answer: z.string().min(1),
  accept: z.array(z.string()).default([]),
});

export const probeSchema = z.union([mcqProbeSchema, tfProbeSchema, estimateProbeSchema, clozeProbeSchema]);
export type Probe = z.infer<typeof probeSchema>;

// ---------- Cards ----------

const cardBase = {
  id: z.string().regex(/^[a-z]+-\d{4}$/),
  interest: interestSchema,
  title: z.string().min(3),
  probes: z.array(probeSchema).min(1).max(2),
  sources: z.array(sourceSchema).min(1),
  difficulty: z.number().int().min(1).max(5),
  version: z.number().int().min(1),
};

export const storyCardSchema = z.object({
  ...cardBase,
  type: z.literal("story"),
  image: imageSchema,
  body: z.object({
    /** 3-5 swipeable panels; the image sits on the first one. */
    panels: z.array(z.object({ text: z.string().min(1) })).min(3).max(5),
  }),
});

export const factWhyCardSchema = z.object({
  ...cardBase,
  type: z.literal("fact_why"),
  image: imageSchema,
  body: z.object({ claim: z.string().min(1), why: z.string().min(1) }),
});

export const guessFirstCardSchema = z
  .object({
    ...cardBase,
    type: z.literal("guess_first"),
    image: imageSchema,
    body: z.object({
      question: z.string().min(1),
      options: z.array(z.string().min(1)).min(2).max(4),
      answer: z.number().int().min(0),
      reveal: z.string().min(1),
    }),
  })
  .refine((c) => c.body.answer < c.body.options.length, { path: ["body", "answer"], message: "answer index out of range" });

export const estimateCardSchema = z
  .object({
    ...cardBase,
    type: z.literal("estimate"),
    image: imageSchema,
    body: z.object({
      question: z.string().min(1),
      unit: z.string(),
      min: z.number(),
      max: z.number(),
      scale: z.enum(["linear", "log"]).default("linear"),
      answer: z.number(),
      reveal: z.string().min(1),
    }),
  })
  .refine((c) => c.body.min < c.body.max && c.body.answer >= c.body.min && c.body.answer <= c.body.max, {
    path: ["body", "answer"],
    message: "answer must lie within min..max",
  });

/** Drills are rule-generated at runtime; the card only names the track and level. No image. */
export const drillCardSchema = z.object({
  ...cardBase,
  type: z.literal("drill"),
  body: z.object({ track: z.enum(["mental-math", "estimation"]), level: z.number().int().min(1) }),
});

/** Recall cards are normally created by the session engine from a probe; this shape is for completeness. */
export const recallCardSchema = z.object({
  ...cardBase,
  type: z.literal("recall"),
  body: z.object({ probe_id: z.string() }),
});

const cardUnion = z.discriminatedUnion("type", [
  storyCardSchema,
  factWhyCardSchema,
  guessFirstCardSchema,
  estimateCardSchema,
  drillCardSchema,
  recallCardSchema,
]);

export const cardSchema = cardUnion.superRefine((card, ctx) => {
  card.probes.forEach((probe, i) => {
    if (!probe.id.startsWith(`${card.id}-p`)) {
      ctx.addIssue({ code: "custom", path: ["probes", i, "id"], message: `probe id must start with "${card.id}-p"` });
    }
  });
});
export type Card = z.infer<typeof cardSchema>;
export type CardType = Card["type"];

// ---------- Manifest ----------

export const manifestSchema = z.object({
  version: z.number().int().min(0),
  generated_at: z.string().optional(),
  cards: z.array(z.object({ id: z.string(), file: z.string(), sha256: z.string() })),
  images: z.array(z.object({ file: z.string(), sha256: z.string(), bytes: z.number().int() })),
});
export type Manifest = z.infer<typeof manifestSchema>;
