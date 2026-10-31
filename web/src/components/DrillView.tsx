import { useEffect, useMemo, useRef, useState } from "react";
import { TRACKS, generateRound, judge, timesOff, type DrillSpec, type Judgement, type SkillProgress } from "../lib/drills";
import { formatNumber } from "../lib/scoring";
import { LEVEL_WINDOW, LEVEL_THRESHOLD } from "../lib/drills";
import { track as signal } from "../analytics";
import { recordDrillRound } from "../lib/session";
import { store } from "../lib/db";
import { emptyProgress } from "../lib/drills";

type Props = {
  spec: DrillSpec;
  index: number;
  total: number;
  onComplete: (result?: { correct?: boolean }) => void;
  onNext: () => void;
};

type Answered = { judgement: Judgement; input: string };

/** A skill-drill round: 3 timed mental-math problems or 2 estimation questions. Generated from rules, no image. */
export function DrillView({ spec, index, total, onComplete, onNext }: Props) {
  const track = TRACKS[spec.track];
  const problems = useMemo(() => generateRound(spec), [spec]);
  // The time allowed grows or shrinks with the number of problems in the round.
  // Mental math stays quick; the other skills (word problems, statistics) get at least half a minute per problem.
  const limitMs = track.timeLimitMs
    ? Math.max(track.timeLimitMs * (problems.length / track.problems), spec.track === "mental-math" ? 0 : 30_000 * problems.length)
    : undefined;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<Answered | null>(null);
  const [done, setDone] = useState<null | { progress: SkillProgress; leveledUp: boolean; right: number }>(null);
  const [left, setLeft] = useState(limitMs ?? 0);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);

  const finish = (all: Answered[]) => {
    if (finished.current) return;
    finished.current = true;
    // Unanswered problems (time ran out) count as wrong attempts.
    const results = problems.map((_, k) => all[k]?.judgement.correct ?? false);
    const right = results.filter(Boolean).length;
    // Practice rounds (a level picked on the skill page) are not counted toward moving up.
    const outcome: Promise<{ progress: SkillProgress; leveledUp: boolean }> = spec.practice
      ? store.getSkills().then((rows) => ({ progress: rows.find((s) => s.track_id === spec.track) ?? emptyProgress(spec.track), leveledUp: false }))
      : recordDrillRound(spec.track, results);
    void outcome.then((r) => {
      setDone({ ...r, right });
      if (!spec.practice) signal("drill.completed", { track: spec.track, level: spec.level, right, total: problems.length });
      if (r.leveledUp) signal("drill.levelUp", { track: spec.track, level: r.progress.level });
      onComplete({ correct: right >= Math.ceil(problems.length / 2) });
      // One problem in a mixed round: go straight on, unless there is a level up to see. (A beat later, so the round knows it is done.)
      if (problems.length === 1 && !r.leveledUp) window.setTimeout(onNext, 60);
    });
  };

  // Countdown runs only while a question is open (paused during feedback).
  useEffect(() => {
    if (!limitMs || feedback || done) return;
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 100)), 100);
    return () => clearInterval(t);
  }, [limitMs, feedback, done]);
  useEffect(() => {
    if (limitMs && left === 0 && !feedback && !done) finish(answers);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!feedback && !done) inputRef.current?.focus();
  }, [i, feedback, done]);

  const problem = problems[i];

  const answerWith = (text: string) => {
    if (!problem || feedback || !text.trim()) return;
    const a = { judgement: judge(spec.track, problem, text), input: text };
    setFeedback(a);
    setAnswers((prev) => [...prev, a]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    answerWith(input);
  };

  const advance = () => {
    const all = feedback ? [...answers] : answers;
    setFeedback(null);
    setInput("");
    if (i + 1 >= problems.length) return finish(all);
    setI(i + 1);
  };

  return (
    <div className={`absolute inset-0 overflow-hidden text-white ${spec.track !== "estimation" ? "bg-gradient-to-br from-indigo-900 via-slate-900 to-black" : "bg-gradient-to-br from-emerald-900 via-slate-900 to-black"}`}>
      <div className="absolute inset-x-0 top-0 z-20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex gap-1" aria-label={`Card ${index + 1} of ${total}`}>
          {Array.from({ length: total }, (_, k) => (
            <div key={k} className={`h-1 flex-1 rounded-full ${k < index ? "bg-white" : k === index ? "bg-white/90" : "bg-white/30"}`} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-white/80">
          <span className="rounded-full bg-black/40 px-2.5 py-1">Drill · {track.name}</span>
          <span className="rounded-full bg-black/40 px-2.5 py-1">Level {spec.level}</span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 top-24 flex flex-col justify-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {!done && problem && (
          <>
            <p className="text-center text-xs uppercase tracking-widest text-white/60">
              {track.levels[spec.level - 1]}{problems.length > 1 ? ` · ${i + 1} of ${problems.length}` : ""}
            </p>

            {limitMs && (
              <div className="mx-auto mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15" aria-label="Time left">
                <div className="h-full rounded-full bg-white/80 transition-[width] duration-100" style={{ width: `${(left / limitMs) * 100}%` }} />
              </div>
            )}

            <h1 className={`mt-8 text-center font-semibold leading-snug ${spec.track !== "estimation" && problem.prompt.length <= 14 ? "text-5xl tabular-nums" : spec.track !== "estimation" && problem.prompt.length <= 50 ? "text-3xl" : "text-xl"}`}>{problem.prompt}</h1>

            {problem.choices ? (
              <div className="mt-8 grid gap-3" role="group" aria-label="Pick your answer">
                {problem.choices.map((label, i) => {
                  const shown = feedback ? (i === problem.answer ? "border-emerald-300 bg-emerald-400/25" : Number(feedback.input) === i ? "border-rose-300 bg-rose-400/25" : "border-white/20 opacity-60") : "border-white/30 bg-white/10 active:scale-[0.98]";
                  return (
                    <button key={i} disabled={!!feedback} onClick={() => answerWith(String(i))} className={`min-h-14 rounded-2xl border px-4 py-3 text-lg font-semibold ${shown}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
            <form onSubmit={submit} className="mt-8">
              <input
                ref={inputRef}
                value={input}
                disabled={!!feedback}
                onChange={(e) => setInput(e.target.value)}
                inputMode={spec.track !== "estimation" ? "decimal" : "text"}
                autoComplete="off"
                placeholder={spec.track !== "estimation" ? "Your answer" : "Your best guess (try 5k or 2m)"}
                aria-label="Your answer"
                className="w-full rounded-2xl border border-white/30 bg-white/10 px-4 py-4 text-center text-2xl text-white placeholder-white/40 outline-none focus:border-white disabled:opacity-70"
              />
              {!feedback && (
                <button type="submit" disabled={!input.trim()} className="mt-3 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900 disabled:opacity-40 active:scale-[0.98]">
                  Check
                </button>
              )}
            </form>
            )}

            {feedback && (
              <div role="status" aria-live="polite" className="mt-4 rounded-2xl bg-white/10 p-4 text-center">
                <p className={`text-lg font-semibold ${feedback.judgement.correct ? "text-emerald-300" : "text-rose-300"}`}>
                  {feedback.judgement.correct ? "✓ " : "✗ "}
                  {feedback.judgement.note}
                </p>
                <p className="mt-1 text-sm text-white/80">
                  {spec.track === "estimation" && feedback.judgement.guess !== undefined
                    ? `You said ${formatNumber(feedback.judgement.guess)} · answer ${formatNumber(problem.answer)} (${timesOff(feedback.judgement.guess, problem.answer).toFixed(1)}× off)`
                    : problem.choices
                      ? `Answer: ${problem.choices[problem.answer]}`
                      : `Answer: ${formatNumber(problem.answer)}`}
                </p>
                {problem.hint && <p className="mt-2 text-sm text-white/70">{problem.hint}</p>}
                <button onClick={advance} className="mt-4 w-full rounded-2xl bg-white py-3 font-semibold text-neutral-900 active:scale-[0.98]">
                  {i + 1 >= problems.length ? (problems.length === 1 ? "Next" : "Finish") : "Next question"}
                </button>
              </div>
            )}
          </>
        )}

        {done && (
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-white/60">{track.name}</p>
            <h1 className="mt-2 text-3xl font-semibold">
              {done.right} of {problems.length} right
            </h1>
            {spec.practice ? (
              <p className="mt-4 text-white/80">
                Level {spec.level} practice. It doesn't count toward your level, so try anything.
              </p>
            ) : done.leveledUp ? (
              <p className="mt-4 rounded-2xl bg-emerald-500/25 px-4 py-3 text-emerald-200">
                Level up! You're now on level {done.progress.level}: {track.levels[done.progress.level - 1]}.
              </p>
            ) : (
              <p className="mt-4 text-white/80">
                Level {done.progress.level}: {done.progress.recent_results.filter(Boolean).length} of your last {done.progress.recent_results.length} right.
                <br />
                <span className="text-sm text-white/60">
                  {done.progress.level >= track.maxLevel
                    ? "You're on the top level."
                    : `Level up at ${Math.round(LEVEL_THRESHOLD * 100)}% over ${LEVEL_WINDOW} attempts.`}
                </span>
              </p>
            )}
            <button onClick={onNext} className="mt-8 w-full rounded-2xl bg-white py-3.5 font-semibold text-neutral-900 active:scale-[0.98]">
              {spec.practice ? "Done" : "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
