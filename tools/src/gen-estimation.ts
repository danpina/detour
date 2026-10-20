// `pnpm --filter tools exec tsx src/gen-estimation.ts`
// Generates the estimation-drill question templates for both apps from content/estimation-templates.json, so the web
// and iOS generators can never drift apart. Both outputs are committed; the shared drill test vectors prove they agree.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

type Param = { n: string; pick?: number[]; lo?: number; hi?: number };
type Template = { level: number; text: string; params: Param[]; mult: (string | number)[] };
type Spec = { levels: string[]; templates: Template[] };

const spec = JSON.parse(await readFile(path.join(ROOT, "content/estimation-templates.json"), "utf8")) as Spec;

// Every template must be self-consistent: each name in `mult` and in the text is a declared parameter.
for (const t of spec.templates) {
  const names = new Set(t.params.map((p) => p.n));
  for (const m of t.mult) if (typeof m === "string" && !names.has(m)) throw new Error(`unknown parameter ${m} in: ${t.text}`);
  for (const m of t.text.matchAll(/\{(\w+)\}/g)) if (!names.has(m[1]!)) throw new Error(`unknown placeholder ${m[0]} in: ${t.text}`);
  if (t.level < 1 || t.level > spec.levels.length) throw new Error(`bad level in: ${t.text}`);
}
for (let level = 1; level <= spec.levels.length; level++) {
  if (!spec.templates.some((t) => t.level === level)) throw new Error(`no templates for level ${level}`);
}

const header = "Generated from content/estimation-templates.json by tools/src/gen-estimation.ts. Do not edit by hand.";

// ---------- TypeScript ----------
const ts = `// ${header}
export type EstimationParam = { n: string; pick?: readonly number[]; lo?: number; hi?: number };
export type EstimationTemplate = { level: number; text: string; params: readonly EstimationParam[]; mult: readonly (string | number)[] };

export const ESTIMATION_LEVELS = ${JSON.stringify(spec.levels)} as const;

export const ESTIMATION_TEMPLATES: readonly EstimationTemplate[] = [
${spec.templates.map((t) => `  ${JSON.stringify(t)},`).join("\n")}
];
`;
await writeFile(path.join(ROOT, "web/src/lib/drills/estimationTemplates.ts"), ts);

// ---------- Swift ----------
const swiftParam = (p: Param) => (p.pick ? `.pick(${JSON.stringify(p.n)}, [${p.pick.join(", ")}])` : `.range(${JSON.stringify(p.n)}, ${p.lo}, ${p.hi})`);
const swiftTerm = (m: string | number) => (typeof m === "string" ? `.param(${JSON.stringify(m)})` : `.constant(${m})`);
const swift = `import Foundation

// ${header}

struct EstimationTemplate {
    enum Param {
        case pick(String, [Int])
        case range(String, Int, Int)
    }

    enum Term {
        case param(String)
        case constant(Int)
    }

    let level: Int
    let text: String
    let params: [Param]
    let mult: [Term]
}

enum EstimationTemplates {
    static let levels: [String] = ${JSON.stringify(spec.levels)}

    static let all: [EstimationTemplate] = [
${spec.templates
  .map((t) => `        EstimationTemplate(level: ${t.level}, text: ${JSON.stringify(t.text)}, params: [${t.params.map(swiftParam).join(", ")}], mult: [${t.mult.map(swiftTerm).join(", ")}]),`)
  .join("\n")}
    ]
}
`;
await writeFile(path.join(ROOT, "ios/Sources/Engine/EstimationTemplates.swift"), swift);

console.log(`${spec.templates.length} templates written for ${spec.levels.length} levels.`);
