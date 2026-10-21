// `pnpm tools draft --topics topics/example.csv [--dry-run] [--limit N] [--types story,fact_why]`
// For each topic: (1) draft a card + probes + sources + image brief, (2) fact-check every claim
// against the fetched source pages, (3) save content/drafts/<id>.json with status "draft".
import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DRAFTABLE_TYPES,
  checkReportSchema,
  draftSchema,
  imageBriefSchema,
  validateImagelessCard,
  type CheckReport,
  type Interest,
} from "@detour/content";
import { z } from "zod";
import { CARDS_DIR } from "./published.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DRAFTS_DIR = path.join(ROOT, "content/drafts");

const ID_PREFIX: Record<Interest, string> = {
  history: "hist",
  science: "sci",
  money: "money",
  tech: "tech",
  mind: "mind",
  numbers: "num",
  // A skill, not a card topic (there are no estimation cards); kept so the map covers every interest.
  estimation: "est",
};

// ---------- small helpers ----------

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (existsSync(file)) process.loadEnvFile(file);
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args[a.slice(2)] = true;
    else (args[a.slice(2)] = next), i++;
  }
  return args;
}

/** Minimal CSV parser: header row, quoted fields, "" escapes. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (row.push(field), (field = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const topicRowSchema = z.object({
  interest: z.enum(["history", "science", "money", "tech", "mind", "numbers"]),
  topic: z.string().min(1),
  angle: z.string().default(""),
});

async function nextIds(interest: Interest, count: number): Promise<string[]> {
  const prefix = ID_PREFIX[interest];
  const pattern = new RegExp(`^${prefix}-(\\d{4})`);
  let max = 0;
  for (const dir of [CARDS_DIR, DRAFTS_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      const m = pattern.exec(f);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + 1 + i).padStart(4, "0")}`);
}

const approxTokens = (s: string) => Math.ceil(s.length / 4);

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("model reply contained no JSON object");
  return JSON.parse(body.slice(start, end + 1));
}

// ---------- prompts ----------

async function exampleFor(type: string): Promise<string> {
  for (const f of (await readdir(CARDS_DIR)).sort()) {
    const card = JSON.parse((await readFile(path.join(CARDS_DIR, f), "utf8")).replace(/^﻿/, ""));
    if (card.type === type) {
      const { image: _image, ...rest } = card;
      return JSON.stringify(rest, null, 2);
    }
  }
  return "{}";
}

const DRAFT_SYSTEM = `You write cards for Detour, a learning app that turns a 60-second scroll habit into things people actually remember.
Output ONE JSON object and nothing else.

Rules:
- Facts must be true and verifiable in the sources you list. If you are unsure of a number or date, leave it out or hedge it. Never invent sources: list only real, specific, public web pages (prefer primary, encyclopedic or institutional pages) whose URL you are confident exists.
- 2-3 sources, each { "title", "url" }.
- Tone: warm, curious, short sentences, no guilt, no hype, no emoji. English.
- Every card has 1-2 probes (recall questions that test the key takeaway, not trivia from the wording). Use kind mcq | tf | estimate | cloze with the exact shapes shown in the example.
- Use the placeholder id "tmp-0000" for the card and "tmp-0000-p1", "tmp-0000-p2" for probes. Set "version": 1. "difficulty" is an integer 1-5.
- Do NOT include an "image" field. Instead include "image_brief": { "show": what the image should depict, "keywords": 3-6 search keywords for open-license image libraries, "real_photo_likely": true if a real photo, painting or scan likely exists in the public domain or under an open license, false if an illustration is needed }.
- Never describe an image that would depict real private individuals, brand logos, or fabricated "evidence".
- The JSON must match the example shape for the requested type exactly.`;

async function draftPrompt(row: z.infer<typeof topicRowSchema>, type: string): Promise<string> {
  return `Interest: ${row.interest}
Topic: ${row.topic}
Angle: ${row.angle || "(none)"}
Card type: ${type}

Example of a finished ${type} card (without its image):
${await exampleFor(type)}

Return the new card as one JSON object with the same fields plus "image_brief".`;
}

const CHECK_SYSTEM = `You are a strict fact-checker for an educational app. You get a card (JSON) and the text of the web pages it cites.
1. List every distinct factual claim the card makes, including claims implied by probe questions and answers.
2. For each claim decide a verdict using ONLY the supplied page text:
   - "pass": a source page clearly supports it (give the source_url and a short verbatim quote, max 25 words).
   - "fail": a source page contradicts it, or the number/date differs (quote the contradicting text).
   - "unverified": the supplied pages neither support nor contradict it, or the page text is missing.
Do not use your own memory to mark a claim as "pass". Output ONE JSON object: { "claims": [ { "claim", "verdict", "source_url", "quote", "note" } ] } and nothing else.`;

// ---------- source fetching ----------

type Fetched = { url: string; fetched: boolean; text: string; error?: string };

async function fetchSource(url: string): Promise<Fetched> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DetourContentTools/0.1; +https://github.com/danpina/detour)" },
      signal: AbortSignal.timeout(20_000),
      redirect: "follow",
    });
    if (!res.ok) return { url, fetched: false, text: "", error: `HTTP ${res.status}` };
    const html = await res.text();
    const text = html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return { url, fetched: true, text: text.slice(0, 20_000) };
  } catch (e) {
    return { url, fetched: false, text: "", error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------- model calls ----------

type Usage = { input: number; output: number };

async function ask(client: Anthropic, model: string, system: string, user: string, maxTokens: number, usage: Usage) {
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  usage.input += res.usage.input_tokens;
  usage.output += res.usage.output_tokens;
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

/** Draft with one repair attempt if the reply does not validate against the schema. */
async function draftCard(client: Anthropic, model: string, prompt: string, usage: Usage) {
  let user = prompt;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await ask(client, model, DRAFT_SYSTEM, user, 3000, usage);
    try {
      const obj = extractJson(reply) as Record<string, unknown>;
      const { image_brief, ...card } = obj;
      const brief = imageBriefSchema.safeParse(image_brief);
      if (!brief.success) throw new Error("image_brief: " + brief.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
      const parsed = validateImagelessCard(card);
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return { card, brief: brief.data };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      user = `${prompt}\n\nYour previous reply was invalid: ${lastError}\nReturn a corrected JSON object.`;
    }
  }
  throw new Error(`draft failed validation twice: ${lastError}`);
}

async function checkCard(
  client: Anthropic,
  model: string,
  card: Record<string, unknown>,
  usage: Usage,
): Promise<CheckReport> {
  const sources = ((card.sources ?? []) as { url: string }[]).map((s) => s.url);
  const fetched = await Promise.all(sources.map(fetchSource));
  const pages = fetched
    .map((f) => (f.fetched ? `--- SOURCE ${f.url}\n${f.text}` : `--- SOURCE ${f.url}\n[could not be fetched: ${f.error}]`))
    .join("\n\n");
  const reply = await ask(client, model, CHECK_SYSTEM, `CARD:\n${JSON.stringify(card, null, 2)}\n\n${pages}`, 3000, usage);
  const obj = extractJson(reply) as { claims?: unknown };
  const claims = z.array(checkReportSchema.shape.claims.element).parse(obj.claims ?? []);
  const allPass = claims.length > 0 && claims.every((c) => c.verdict === "pass") && fetched.every((f) => f.fetched);
  return {
    checked_at: new Date().toISOString(),
    model,
    sources: fetched.map(({ url, fetched: ok, error }) => ({ url, fetched: ok, ...(error ? { error } : {}) })),
    claims,
    overall: allPass ? "pass" : "flagged",
  };
}

// ---------- main ----------

function money(tokens: number, perMillion: number) {
  return (tokens / 1_000_000) * perMillion;
}

export async function runDraft(argv: string[]): Promise<number> {
  loadEnv();
  const args = parseArgs(argv);
  const topicsArg = args.topics;
  if (typeof topicsArg !== "string") {
    console.error("Usage: pnpm tools draft --topics <file.csv> [--dry-run] [--limit N] [--types story,fact_why,guess_first,estimate]");
    return 1;
  }
  const candidates = [path.resolve(topicsArg), path.resolve(ROOT, topicsArg), path.resolve(ROOT, "tools", topicsArg)];
  const topicsFile = candidates.find(existsSync);
  if (!topicsFile) {
    console.error(`Topics file not found: ${topicsArg}`);
    return 1;
  }
  const dryRun = args["dry-run"] === true;
  const limit = typeof args.limit === "string" ? Number(args.limit) : Infinity;
  const types = (typeof args.types === "string" ? args.types.split(",") : [...DRAFTABLE_TYPES]).map((t) => t.trim());
  for (const t of types) {
    if (!(DRAFTABLE_TYPES as readonly string[]).includes(t)) {
      console.error(`Cannot draft card type "${t}". Allowed: ${DRAFTABLE_TYPES.join(", ")}`);
      return 1;
    }
  }

  const rows = parseCsv(await readFile(topicsFile, "utf8"))
    .slice(0, limit)
    .map((r, i) => {
      const p = topicRowSchema.safeParse(r);
      if (!p.success) throw new Error(`Row ${i + 2} of ${topicsFile}: ${p.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
      return p.data;
    });

  // Rotate card types across rows so each batch is mixed, unless --types narrows it.
  const plan = rows.map((row, i) => ({ row, type: types[i % types.length]! }));
  const idsByInterest = new Map<Interest, string[]>();
  for (const interest of new Set(plan.map((p) => p.row.interest))) {
    idsByInterest.set(interest, await nextIds(interest, plan.filter((p) => p.row.interest === interest).length));
  }
  const taken = new Map<Interest, number>();
  const planned = plan.map((p) => {
    const n = taken.get(p.row.interest) ?? 0;
    taken.set(p.row.interest, n + 1);
    return { ...p, id: idsByInterest.get(p.row.interest)![n]! };
  });

  // Cost estimate: prompt sizes are exact-ish; output and check-prompt sizes are assumptions.
  let estIn = 0;
  let estOut = 0;
  for (const p of planned) {
    estIn += approxTokens(DRAFT_SYSTEM) + approxTokens(await draftPrompt(p.row, p.type));
    estOut += 1200; // drafted card
    estIn += approxTokens(CHECK_SYSTEM) + 1200 + 3 * 4000; // card + ~3 source pages (20k chars cap each)
    estOut += 1000; // check report
  }
  const priceIn = Number(process.env.CONTENT_PRICE_IN_PER_MTOK);
  const priceOut = Number(process.env.CONTENT_PRICE_OUT_PER_MTOK);
  const model = process.env.CONTENT_MODEL ?? "";

  console.log(`Topics: ${planned.length} from ${path.relative(ROOT, topicsFile)}   Model: ${model || "(CONTENT_MODEL not set)"}`);
  for (const p of planned) console.log(`  ${p.id}  ${p.type.padEnd(12)} ${p.row.interest}: ${p.row.topic}`);
  console.log(`Estimated tokens: ~${estIn.toLocaleString()} in, ~${estOut.toLocaleString()} out (upper-ish guess; sources vary)`);
  if (priceIn > 0 && priceOut > 0) {
    console.log(`Estimated cost: ~$${(money(estIn, priceIn) + money(estOut, priceOut)).toFixed(3)} (at $${priceIn}/$${priceOut} per million tokens)`);
  } else {
    console.log("Set CONTENT_PRICE_IN_PER_MTOK and CONTENT_PRICE_OUT_PER_MTOK in .env.local to also print a cost estimate.");
  }
  if (dryRun) {
    console.log("Dry run: no API calls made, nothing written.");
    return 0;
  }

  if (!process.env.ANTHROPIC_API_KEY || !model) {
    console.error("Set ANTHROPIC_API_KEY and CONTENT_MODEL in .env.local (see .env.example).");
    return 1;
  }
  const client = new Anthropic();
  await mkdir(DRAFTS_DIR, { recursive: true });
  const usage: Usage = { input: 0, output: 0 };
  let failures = 0;

  for (const p of planned) {
    process.stdout.write(`${p.id} ${p.row.topic} … `);
    try {
      const { card, brief } = await draftCard(client, model, await draftPrompt(p.row, p.type), usage);
      const json = JSON.stringify(card).replaceAll("tmp-0000", p.id);
      const finalCard = JSON.parse(json) as Record<string, unknown>;
      const check = await checkCard(client, model, finalCard, usage);
      const draft = draftSchema.parse({
        status: "draft",
        topic: p.row,
        created_at: new Date().toISOString(),
        model,
        card: finalCard,
        image_brief: brief,
        check,
      });
      await writeFile(path.join(DRAFTS_DIR, `${p.id}.json`), JSON.stringify(draft, null, 2) + "\n");
      const bad = check.claims.filter((c) => c.verdict !== "pass").length;
      console.log(`saved (${check.overall}${bad ? `, ${bad} of ${check.claims.length} claims need a look` : ""})`);
    } catch (e) {
      failures++;
      console.log(`FAILED: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`Tokens used: ${usage.input.toLocaleString()} in, ${usage.output.toLocaleString()} out`);
  if (priceIn > 0 && priceOut > 0) console.log(`Cost: ~$${(money(usage.input, priceIn) + money(usage.output, priceOut)).toFixed(3)}`);
  return failures ? 1 : 0;
}
