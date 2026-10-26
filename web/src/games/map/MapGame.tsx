import { useEffect, useMemo, useRef, useState } from "react";
import type { GameProps } from "../registry";
import { recordRound, roundFor } from "../stats";
import { loadMap } from "./mapData";
import {
  buildRound,
  DEFAULT_SETTINGS,
  DIFFICULTY_NAMES,
  judge,
  prompt,
  REGIONS,
  regionBox,
  subjectWord,
  SUBJECTS,
  targetName,
  type Difficulty,
  type MapData,
  type MapSettings,
  type Region,
  type Subject,
  type Target,
  type Verdict,
} from "./mapLogic";

const KEY = "detour.games.map";

function loadSettings(): MapSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<MapSettings> | null;
    if (!raw) return DEFAULT_SETTINGS;
    const subject = SUBJECTS.some((s) => s.id === raw.subject) ? (raw.subject as Subject) : DEFAULT_SETTINGS.subject;
    const region = REGIONS.includes(raw.region as Region) ? (raw.region as Region) : DEFAULT_SETTINGS.region;
    const difficulty = raw.difficulty === 2 || raw.difficulty === 3 ? raw.difficulty : 1;
    return { subject, region, difficulty };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: MapSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage unavailable: the choice lasts until the page is closed.
  }
}

function endLine(score: number, total: number): string {
  if (score === total) return "A true navigator. Not one miss.";
  if (score * 10 >= total * 7) return "You know your way around.";
  if (score * 10 >= total * 4) return "Good run. Maps stick the more you look.";
  return "Every miss is a place you'll remember next time.";
}

const pathOf = (rings: number[][]) =>
  rings
    .map((r) => {
      let d = "";
      for (let i = 0; i + 1 < r.length; i += 2) d += (i === 0 ? "M" : "L") + r[i] + " " + r[i + 1];
      return d + "Z";
    })
    .join("");

const lineOf = (line: number[]) => {
  let d = "";
  for (let i = 0; i + 1 < line.length; i += 2) d += (i === 0 ? "M" : "L") + line[i] + " " + line[i + 1];
  return d;
};

function MapRound({ data, settings, onExit, embedded, onSettings }: GameProps & { data: MapData; settings: MapSettings; onSettings: () => void }) {
  const [round, setRound] = useState<Target[]>(() => buildRound(data, settings, Math.random, roundFor(embedded)));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [best, setBest] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const finishedRef = useRef(false);

  const paths = useMemo(() => data.countries.map((c) => ({ c, d: pathOf(c.rings) })), [data]);
  const home = useMemo(() => regionBox(data, settings.region), [data, settings.region]);
  const [box, setBox] = useState<[number, number, number, number]>(home);
  // A thin line whatever the zoom: strokes are measured in map units, so scale them with what is on screen.
  const unit = box[2] / 1000;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: false, startDist: 0, startW: 0 });

  const target = round[index];
  const total = round.length;
  const answered = verdict !== null;
  const done = index >= total;
  const showRivers = settings.subject === "rivers" || settings.subject === "mixed";
  const showMountains = settings.subject === "mountains" || settings.subject === "mixed";

  function finishEmbedded(finalScore: number) {
    if (finishedRef.current || !embedded) return;
    finishedRef.current = true;
    recordRound("map", finalScore);
    embedded.onDone(finalScore);
  }

  /** Keeps the view inside the map, and no more zoomed in or out than is useful. */
  function clampBox(x: number, y: number, w: number): [number, number, number, number] {
    const width = Math.max(500, Math.min(data.w, w));
    const height = width * (home[3] / home[2]);
    return [Math.max(0, Math.min(data.w - width, x)), Math.max(0, Math.min(data.h - height, y)), width, height];
  }

  function zoomBy(factor: number) {
    setBox((b) => {
      const w = b[2] * factor;
      const cx = b[0] + b[2] / 2;
      const cy = b[1] + b[3] / 2;
      const next = clampBox(cx - w / 2, cy - (w * (b[3] / b[2])) / 2, w);
      return next;
    });
  }

  function judgeTap(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg || !target || answered) return;
    const m = svg.getScreenCTM();
    if (!m) return;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(m.inverse());
    const v = judge(data, target, p.x, p.y);
    setTap({ x: p.x, y: p.y });
    setVerdict(v);
    if (v.correct) setScore((s) => s + 1);
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current.moved = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { moved: true, startDist: Math.hypot(a!.x - b!.x, a!.y - b!.y), startW: box[2] };
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.min(rect.width / box[2], rect.height / box[3]); // screen pixels per map unit
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (gesture.current.startDist > 0) {
        const w = gesture.current.startW * (gesture.current.startDist / dist);
        setBox((cur) => clampBox(cur[0] + cur[2] / 2 - w / 2, cur[1] + cur[3] / 2 - (w * (cur[3] / cur[2])) / 2, w));
      }
      return;
    }
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    if (!gesture.current.moved && Math.hypot(dx, dy) < 4) return;
    // Tiny wobbles still count as a tap; a real drag pans the map.
    if (!gesture.current.moved && Math.hypot(now.x - prev.x, now.y - prev.y) >= 4) gesture.current.moved = true;
    setBox((cur) => clampBox(cur[0] - dx / px, cur[1] - dy / px, cur[2]));
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const wasTap = pointers.current.size === 1 && !gesture.current.moved;
    pointers.current.delete(e.pointerId);
    if (wasTap) judgeTap(e.clientX, e.clientY);
  }

  function next() {
    if (index + 1 >= total) {
      if (embedded) {
        finishEmbedded(score);
        return;
      }
      setBest(recordRound("map", score));
    }
    setIndex((i) => i + 1);
    setVerdict(null);
    setTap(null);
  }

  function again() {
    setRound(buildRound(data, settings, Math.random, roundFor(embedded)));
    setIndex(0);
    setScore(0);
    setVerdict(null);
    setTap(null);
    setBest(false);
  }

  if (total === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-neutral-500 dark:text-neutral-400">There is nothing to ask about here. Try another region.</p>
        <button onClick={embedded ? onExit : onSettings} className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white">{embedded ? "Skip" : "Change region"}</button>
      </div>
    );
  }

  if (done && !embedded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 pb-[env(safe-area-inset-bottom)] text-center">
        <div className="text-6xl">🗺️</div>
        <h1 className="text-3xl font-semibold tracking-tight">{score} / {total}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">{endLine(score, total)}</p>
        {best && score > 0 && <p className="text-sm font-medium text-teal-600 dark:text-teal-400">New best!</p>}
        <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
          <button onClick={again} className="min-h-14 rounded-2xl bg-teal-600 px-6 py-3 text-lg font-semibold text-white active:scale-[0.98]">Play again</button>
          <button onClick={onSettings} className="min-h-14 rounded-2xl border border-neutral-300 px-6 py-3 text-lg font-semibold active:scale-[0.98] dark:border-neutral-700">Change the map</button>
          <button onClick={onExit} className="min-h-12 rounded-2xl px-6 py-2 text-neutral-500 dark:text-neutral-400">Back</button>
        </div>
      </div>
    );
  }
  if (done || !target) return null;

  const isLast = index === total - 1;
  const lineClass = (hot: boolean) => (hot ? "stroke-emerald-500" : "stroke-sky-500/70 dark:stroke-sky-400/60");

  return (
    <div className="flex h-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
        {embedded ? (
          <span className="font-medium">A little geography</span>
        ) : (
          <button onClick={onExit} className="-ml-2 min-h-11 px-2" aria-label="Back">Back</button>
        )}
        <span>{index + 1} / {total}</span>
        {embedded ? <button onClick={onExit} className="-mr-2 min-h-11 px-2" aria-label="Skip">Skip</button> : <span>Score {score}</span>}
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <div className="h-full rounded-full bg-teal-500 transition-all duration-300" style={{ width: `${(Math.min(index + (answered ? 1 : 0), total) / total) * 100}%` }} />
      </div>

      <div className="mt-3 text-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{subjectWord(target)}</p>
        <p className="text-2xl font-semibold tracking-tight">{prompt(target)}</p>
      </div>

      <div className="relative mt-3 flex-1 overflow-hidden rounded-2xl bg-sky-50 dark:bg-slate-900">
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          <button onClick={() => zoomBy(0.6)} aria-label="Zoom in" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl font-semibold shadow dark:bg-neutral-800/90">+</button>
          <button onClick={() => zoomBy(1 / 0.6)} aria-label="Zoom out" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl font-semibold shadow dark:bg-neutral-800/90">−</button>
          <button onClick={() => setBox(home)} aria-label="Show the whole region" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-sm font-semibold shadow dark:bg-neutral-800/90">⟲</button>
        </div>
        <svg
          ref={svgRef}
          viewBox={box.join(" ")}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
          className="h-full w-full touch-none select-none"
          role="img"
          aria-label={"World map. " + subjectWord(target) + " " + prompt(target) + "."}
        >
          {paths.map(({ c, d }) => {
            const isTarget = target.kind === "country" && target.country.id === c.id;
            const wasTapped = answered && !verdict.correct && verdict.tapped === c.name;
            const fill = answered && isTarget ? "fill-emerald-500" : wasTapped ? "fill-rose-400" : "fill-neutral-200 dark:fill-neutral-700";
            return <path key={c.id} d={d} className={`${fill} stroke-white dark:stroke-slate-900`} strokeWidth={0.8 * unit} strokeLinejoin="round" />;
          })}

          {showRivers &&
            data.rivers.map((r) => {
              const hot = answered && target.kind === "river" && target.river.name === r.name;
              const wasTapped = answered && !verdict.correct && verdict.tapped === r.name;
              return (
                <g key={r.name} className={wasTapped ? "stroke-rose-500" : lineClass(hot)} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  {r.lines.map((l, i) => (
                    <path key={i} d={lineOf(l)} strokeWidth={(hot || wasTapped ? 3.2 : 1.6) * unit} />
                  ))}
                </g>
              );
            })}

          {showMountains &&
            data.mountains.map((m) => {
              const hot = answered && target.kind === "mountain" && target.mountain.name === m.name;
              const wasTapped = answered && !verdict.correct && verdict.tapped === m.name;
              if (m.line) {
                // A range is drawn along its spine, like a river, in the colour of mountains.
                const stroke = hot ? "stroke-emerald-500" : wasTapped ? "stroke-rose-500" : "stroke-amber-700/70 dark:stroke-amber-400/70";
                return <path key={m.name} d={lineOf(m.line)} className={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={(hot || wasTapped ? 6 : 4) * unit} />;
              }
              const r = 5 * unit;
              const colour = hot ? "fill-emerald-500" : wasTapped ? "fill-rose-500" : "fill-amber-700/80 dark:fill-amber-400/80";
              return <path key={m.name} d={`M${m.at[0]} ${m.at[1] - r}L${m.at[0] + r} ${m.at[1] + r * 0.8}L${m.at[0] - r} ${m.at[1] + r * 0.8}Z`} className={colour} />;
            })}

          {answered && target.kind === "country" && !verdict.correct && (
            // Wrong: ring the right country's middle too, so a small one is easy to spot.
            <circle cx={target.country.label[0]} cy={target.country.label[1]} r={14 * unit} className="fill-none stroke-emerald-600" strokeWidth={2.2 * unit} />
          )}
          {answered && target.kind === "mountain" && (
            <circle cx={target.mountain.at[0]} cy={target.mountain.at[1]} r={14 * unit} className="fill-none stroke-emerald-600" strokeWidth={2.2 * unit} />
          )}
          {tap && <circle cx={tap.x} cy={tap.y} r={4.5 * unit} className={verdict?.correct ? "fill-emerald-600 stroke-white" : "fill-rose-600 stroke-white"} strokeWidth={1.2 * unit} />}
        </svg>
      </div>

      <div className="mt-3 min-h-20" aria-live="polite">
        {answered ? (
          <div className="game-rise">
            <p className="font-semibold">
              {verdict.correct ? "Yes, that's " + targetName(target) + "." : verdict.tapped ? `That's ${verdict.tapped}. ${targetName(target)} is marked in green.` : `Not quite. ${targetName(target)} is marked in green.`}
            </p>
            <button onClick={next} className="mt-2 min-h-12 w-full rounded-2xl bg-teal-600 px-6 py-2.5 text-lg font-semibold text-white active:scale-[0.98]">
              {isLast ? (embedded ? "Continue" : "See my score") : "Next"}
            </button>
          </div>
        ) : (
          <p className="pt-3 text-center text-sm text-neutral-500 dark:text-neutral-400">Tap the map where you think it is. Drag or pinch to move and zoom.</p>
        )}
      </div>
    </div>
  );
}

function Setup({ settings, onStart, onExit }: { settings: MapSettings; onStart: (s: MapSettings) => void; onExit: () => void }) {
  const [draft, setDraft] = useState<MapSettings>(settings);
  const chip = (on: boolean) =>
    "min-h-11 rounded-full border px-4 py-1.5 text-sm font-medium " +
    (on ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-200" : "border-neutral-300 dark:border-neutral-700");
  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <button onClick={onExit} className="-ml-2 min-h-11 self-start px-2 text-sm text-neutral-500 dark:text-neutral-400" aria-label="Back">Back</button>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Find it on the map</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">Tap where it is. Pick what to look for and where.</p>

      <p className="mt-6 text-sm font-medium text-neutral-500 dark:text-neutral-400">What to find</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="What to find">
        {SUBJECTS.map((s) => (
          <button key={s.id} aria-pressed={draft.subject === s.id} onClick={() => setDraft((d) => ({ ...d, subject: s.id }))} className={chip(draft.subject === s.id)}>{s.label}</button>
        ))}
      </div>

      <p className="mt-5 text-sm font-medium text-neutral-500 dark:text-neutral-400">Where</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Where">
        {REGIONS.map((r) => (
          <button key={r} aria-pressed={draft.region === r} onClick={() => setDraft((d) => ({ ...d, region: r }))} className={chip(draft.region === r)}>{r}</button>
        ))}
      </div>

      <p className="mt-5 text-sm font-medium text-neutral-500 dark:text-neutral-400">How hard</p>
      <div className="mt-2 flex gap-2" role="group" aria-label="How hard">
        {([1, 2, 3] as Difficulty[]).map((d) => (
          <button key={d} aria-pressed={draft.difficulty === d} onClick={() => setDraft((cur) => ({ ...cur, difficulty: d }))} className={chip(draft.difficulty === d) + " flex-1"}>{DIFFICULTY_NAMES[d]}</button>
        ))}
      </div>
      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Easy asks about the big ones first. Hard includes the small countries.</p>

      <div className="flex-1" />
      <button onClick={() => onStart(draft)} className="mt-6 w-full rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white transition active:scale-[0.98]">Start</button>
    </div>
  );
}

/** Find countries, rivers and mountains by tapping the map. The map loads when the game opens. */
export function MapGame(props: GameProps) {
  const [data, setData] = useState<MapData | null>(null);
  const [failed, setFailed] = useState(false);
  const [settings, setSettings] = useState<MapSettings>(loadSettings);
  const [setup, setSetup] = useState(!props.embedded);
  const [run, setRun] = useState(0);

  useEffect(() => {
    let live = true;
    loadMap().then(
      (m) => live && setData(m),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-neutral-500 dark:text-neutral-400">The map isn't available right now.</p>
        <button onClick={props.onExit} className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white">{props.embedded ? "Skip" : "Back"}</button>
      </div>
    );
  }
  if (!data) return <div className="flex h-full items-center justify-center text-neutral-500 dark:text-neutral-400" aria-busy="true">Loading the map…</div>;
  if (setup) {
    return (
      <Setup
        settings={settings}
        onExit={props.onExit}
        onStart={(s) => {
          setSettings(s);
          saveSettings(s);
          setSetup(false);
          setRun((r) => r + 1);
        }}
      />
    );
  }
  return <MapRound key={run} {...props} data={data} settings={settings} onSettings={() => setSetup(true)} />;
}
