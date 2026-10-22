// Regenerates spec/golden.json. Refuses while VERSIONS.md says v1 is frozen: a frozen version is never rewritten,
// a new version gets its own entries.
import { readFileSync, writeFileSync } from "node:fs";
import { MOODS, compose, createBehavior, generate, toSVG, type AttentionMode, type Grid } from "../packages/core/src";
import { fnv1a, utf8 } from "../packages/core/src/hash";
import { createRng } from "../packages/core/src/rng";

export const hex = (n: number): string => n.toString(16).padStart(8, "0");
export const gridHash = (g: Grid): string => hex(fnv1a(Array.from(g)));

const WORDS = `
bubbanbbebb jsakkkwaakiyy bubba mumu moon noodle bubble loom woolly mellow boom mum
kick zzkt tick quartz jinx kixtz pixel tackle spike zap jazz xk
sagar claude alice bob groot muse groq dots pixie tyler
a b c d e f g h i j k l m n o p q r s t u v w x y z
aa ab ba ko ki mo mi zu za
aaaaaa kkkkkk bbbbbb tttttt mnmnmn ztztzt oooooo iiiiii
`.trim().split(/\s+/);

const PHRASES = [
  "", " ", "   ", "?", "!!!", "123", "0", "hello world", "Hello World", "  hello   world  ",
  "sleepy cloud", "angry wasp", "a tiny round pebble", "razor wire", "soft pillow", "thunderbolt",
  "the quick brown fox jumps over the lazy dog",
  "café", "café", "Éclair", "naïve", "你好", "こんにちは", "привет",
  "\u{1F600}", "\u{1F600}\u{1F601}\u{1F602}", "🚀 rocket", "\ufffd", "tab\tand\nnewline",
  "x".repeat(300), "bubba ".repeat(40), "A".repeat(128), "A".repeat(129),
];

function randomText(rng: ReturnType<typeof createRng>): string {
  const len = 3 + rng.int(10);
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(97 + rng.int(26));
  return s;
}

export function buildInputs(): string[] {
  const rng = createRng(20261022);
  const inputs = [...WORDS, ...PHRASES];
  while (inputs.length < 500) inputs.push(randomText(rng));
  return inputs;
}

export function entry(input: string) {
  const s = generate(input);
  const moods: Record<string, string> = {};
  for (const m of MOODS) moods[m] = gridHash(compose(s, { mood: m }));
  return {
    input,
    normalized: s.text,
    seed: hex(s.seed),
    traits: [s.traits.roundness, s.traits.heft, s.traits.energy, s.traits.chaos, s.traits.slink],
    template: s.template,
    mark: s.mark,
    eyeStyle: s.eyeStyle,
    anchors: [s.anchors.eyeY, s.anchors.eyeInner, s.anchors.mouthY],
    colors: s.colors.slice(1).join(","),
    grid: gridHash(s.grid),
    body: gridHash(s.body),
    moods,
    pose: gridHash(compose(s, { mood: "thinking", gaze: { x: 1, y: -1 }, blink: true, lift: 2, dx: 1, lean: -2, squash: 1, wave: 3, amp: 1 })),
    squash: gridHash(compose(s, { squash: -2, lean: 3 })),
    svg: hex(fnv1a(utf8(toSVG(s.grid, s.colors)))),
  };
}

/** Scripted input for the behavior traces. Ports replay it step by step (100 ms per step). */
export const BEHAVIOR_SCRIPT: Array<{ t: number; op: string; x?: number; y?: number; mood?: string; ms?: number }> = [
  { t: 1000, op: "lookAt", x: 1, y: 0 },
  { t: 6000, op: "lookAt", x: -1, y: 0.5 },
  { t: 9000, op: "lookAt", x: 0.2, y: -1 },
  { t: 12000, op: "lookAt" },
  { t: 20000, op: "focus", x: -0.8, y: 0.9 },
  { t: 22000, op: "focus" },
  { t: 26000, op: "react", mood: "happy", ms: 900 },
  { t: 30000, op: "setMood", mood: "sad" },
  { t: 34000, op: "setMood" },
  { t: 40000, op: "poke" },
  { t: 41000, op: "lookAt", x: 1, y: 1 },
  { t: 41500, op: "react", mood: "thinking", ms: 3000 },
  { t: 44000, op: "clearReaction" },
];
export const BEHAVIOR_STEPS = 900; // 90 seconds

export const BEHAVIOR_CASES: Array<{ text: string; attention: AttentionMode; reducedMotion: boolean; sleepAfterMs: number }> = [
  { text: "bubbanbbebb", attention: "sometimes", reducedMotion: false, sleepAfterMs: 30000 },
  { text: "jsakkkwaakiyy", attention: "sometimes", reducedMotion: false, sleepAfterMs: 30000 },
  { text: "moon", attention: "always", reducedMotion: false, sleepAfterMs: 0 },
  { text: "zzkt", attention: "never", reducedMotion: false, sleepAfterMs: 30000 },
  { text: "sleepy cloud", attention: "sometimes", reducedMotion: true, sleepAfterMs: 30000 },
  { text: "sagar", attention: "sometimes", reducedMotion: false, sleepAfterMs: 8000 },
  { text: "sssnake", attention: "sometimes", reducedMotion: false, sleepAfterMs: 0 },
  { text: "claude", attention: "always", reducedMotion: false, sleepAfterMs: 0 },
  { text: "noodle", attention: "sometimes", reducedMotion: false, sleepAfterMs: 0 },
  { text: "kick", attention: "sometimes", reducedMotion: false, sleepAfterMs: 20000 },
];

export function behaviorTrace(c: (typeof BEHAVIOR_CASES)[number]): { hash: string; asleepSteps: number; blinks: number } {
  const s = generate(c.text);
  const b = createBehavior({ seed: s.seed, traits: s.traits, template: s.template, attention: c.attention, reducedMotion: c.reducedMotion, sleepAfterMs: c.sleepAfterMs });
  let trace = "";
  let asleepSteps = 0;
  let blinks = 0;
  let next = 0;
  for (let i = 0; i < BEHAVIOR_STEPS; i++) {
    const t = i * 100;
    while (next < BEHAVIOR_SCRIPT.length && BEHAVIOR_SCRIPT[next]!.t <= t) {
      const e = BEHAVIOR_SCRIPT[next++]!;
      if (e.op === "lookAt") b.lookAt(e.x === undefined ? null : { x: e.x, y: e.y! });
      else if (e.op === "focus") b.focus(e.x === undefined ? null : { x: e.x, y: e.y! });
      else if (e.op === "react") b.react(e.mood as never, e.ms);
      else if (e.op === "setMood") b.setMood((e.mood as never) ?? null);
      else if (e.op === "poke") b.poke();
      else if (e.op === "clearReaction") b.clearReaction();
    }
    const p = b.tick(100);
    if (b.attention === "asleep") asleepSteps++;
    if (p.blink) blinks++;
    trace += `${p.mood},${p.gaze.x},${p.gaze.y},${p.blink ? 1 : 0},${p.lift},${p.dx},${p.lean},${p.squash},${p.wave},${p.amp},${b.attention};`;
  }
  return { hash: hex(fnv1a(utf8(trace))), asleepSteps, blinks };
}

if (process.argv[1]?.endsWith("golden.ts")) {
  if (/\|\s*1\s*\|\s*\*\*frozen\*\*/.test(readFileSync(new URL("../spec/VERSIONS.md", import.meta.url), "utf8"))) {
    console.error("Algorithm v1 is frozen (spec/VERSIONS.md): refusing to rewrite spec/golden.json. Revert the change that altered the output.");
    process.exit(1);
  }
  const out = {
    version: 1,
    count: 0,
    entries: buildInputs().map(entry),
    behavior: { stepMs: 100, steps: BEHAVIOR_STEPS, script: BEHAVIOR_SCRIPT, cases: BEHAVIOR_CASES.map((c) => ({ ...c, ...behaviorTrace(c) })) },
  };
  out.count = out.entries.length;
  writeFileSync(new URL("../spec/golden.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
  console.log(`wrote ${out.count} entries`);
}
