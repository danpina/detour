// `pnpm tools review [--port 4173]`
// Local review UI (bound to 127.0.0.1 only). Lists drafts with their fact-check report and image candidates.
// You can edit text, pick an image and crop, then approve (optimize + publish) or reject.
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import type { CandidatesFile } from "./images.js";
import { DRAFTS_DIR, UserError, approve, getDraft, readJsonFile, reject, saveCard } from "./publish.js";
import { loadCards } from "./published.js";

const isId = (s: string) => /^[a-z]+-\d{4}$/.test(s);

// ---------- data access ----------

async function listDrafts() {
  const out: unknown[] = [];
  for (const f of (await readdir(DRAFTS_DIR)).filter((f) => /^[a-z]+-\d{4}\.json$/.test(f)).sort()) {
    const id = f.replace(".json", "");
    try {
      const d = await readJsonFile(path.join(DRAFTS_DIR, f));
      const cand = existsSync(path.join(DRAFTS_DIR, `${id}.images`, "candidates.json"))
        ? ((await readJsonFile(path.join(DRAFTS_DIR, `${id}.images`, "candidates.json"))) as CandidatesFile)
        : undefined;
      out.push({
        id,
        title: d.card?.title,
        type: d.card?.type,
        interest: d.card?.interest,
        check: d.sent_back ? "sent back" : (d.check?.overall ?? "none"),
        candidates: cand?.candidates.length ?? 0,
        needs_image: d.card?.type !== "drill" && d.card?.type !== "recall",
      });
    } catch {
      out.push({ id, title: "(unreadable draft)", check: "none", candidates: 0 });
    }
  }
  return out;
}

async function stats() {
  const published = (await loadCards()).length;
  const sub = async (d: string) => (existsSync(path.join(DRAFTS_DIR, d)) ? (await readdir(DRAFTS_DIR + "/" + d)).filter((f) => f.endsWith(".json")).length : 0);
  const byInterest: Record<string, number> = {};
  for (const l of await loadCards()) if (l.card) byInterest[l.card.interest] = (byInterest[l.card.interest] ?? 0) + 1;
  return { published, rejected: await sub("_rejected"), byInterest };
}

// ---------- http ----------

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

function send(res: http.ServerResponse, status: number, body: unknown, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : (body as Buffer | string));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 2_000_000) throw new UserError("Body too large");
    chunks.push(c as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export async function runReview(argv: string[]): Promise<number> {
  const pi = argv.indexOf("--port");
  const port = pi >= 0 ? Number(argv[pi + 1]) : 4173;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const html = await readFile(path.join(import.meta.dirname, "review-ui.html"), "utf8");

  const server = http.createServer(async (req, res) => {
    try {
      // Localhost-only hardening: refuse foreign Host headers (DNS rebinding) and cross-origin writes.
      if (!allowedHosts.has(req.headers.host ?? "")) return send(res, 403, { error: "forbidden host" });
      const origin = req.headers.origin;
      if (req.method !== "GET" && origin && !allowedHosts.has(new URL(origin).host)) return send(res, 403, { error: "forbidden origin" });

      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const parts = url.pathname.split("/").filter(Boolean);

      if (req.method === "GET" && url.pathname === "/") return send(res, 200, html, "text/html; charset=utf-8");
      if (req.method === "GET" && url.pathname === "/api/drafts") return send(res, 200, { drafts: await listDrafts(), stats: await stats() });

      if (parts[0] === "api" && parts[1] === "drafts" && parts[2] && isId(parts[2])) {
        const id = parts[2];
        if (!existsSync(path.join(DRAFTS_DIR, `${id}.json`))) return send(res, 404, { error: "no such draft" });
        if (req.method === "GET" && parts.length === 3) return send(res, 200, await getDraft(id));
        if (req.method === "GET" && parts[3] === "preview" && parts[4]) {
          const file = path.basename(parts[4]);
          const full = path.join(DRAFTS_DIR, `${id}.images`, file);
          if (!existsSync(full)) return send(res, 404, { error: "no preview" });
          return send(res, 200, await readFile(full), MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
        }
        if (req.method === "PUT" && parts.length === 3) {
          await saveCard(id, (await readBody(req)).card);
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && parts[3] === "reject") {
          await reject(id);
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && parts[3] === "approve") return send(res, 200, await approve(id, await readBody(req)));
      }
      send(res, 404, { error: "not found" });
    } catch (e) {
      if (e instanceof UserError) return send(res, 400, { error: e.message, issues: e.issues });
      console.error(e);
      send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(`Review UI running at http://localhost:${port}  (Ctrl+C to stop)`);
  await new Promise(() => {});
  return 0;
}
