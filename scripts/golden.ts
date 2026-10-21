// Regenerates spec/golden.json. v1 is a draft until VERSIONS.md says frozen; after that, only add
// a new version's entries, never rewrite an old one.
import { writeFileSync } from "node:fs";
import { MOODS, compose, generate, type Grid } from "../packages/core/src";
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
  "\u{1F600}", "\u{1F600}\u{1F601}\u{1F602}", "🚀 rocket", "\ud800", "tab\tand\nnewline",
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
    traits: [s.traits.roundness, s.traits.heft, s.traits.energy, s.traits.chaos],
    template: s.template,
    eyeStyle: s.eyeStyle,
    anchors: [s.anchors.eyeY, s.anchors.eyeInner, s.anchors.mouthY],
    colors: s.colors.slice(1).join(","),
    grid: gridHash(s.grid),
    body: gridHash(s.body),
    moods,
    pose: gridHash(compose(s, { mood: "thinking", gaze: { x: 1, y: -1 }, blink: true, bob: true })),
  };
}

if (process.argv[1]?.endsWith("golden.ts")) {
  const out = { version: 1, count: 0, entries: buildInputs().map(entry) };
  out.count = out.entries.length;
  writeFileSync(new URL("../spec/golden.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
  console.log(`wrote ${out.count} entries`);
}
