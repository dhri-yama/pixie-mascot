import { MOODS, compose, createBehavior, describe, generate, normalize, toSVG, toSmoothSVG, type Behavior, type Mood, type PresetName } from "@pixie/core";

const DEFAULT_WORDS = `
bubbanbbebb, jsakkkwaakiyy, bubba, mumu, moon, noodle, bubble, loom, woolly, mellow, boom, mum
kick, zzkt, tick, quartz, jinx, kixtz, pixel, tackle, spike, zap, jazz, xk
sagar, claude, alice, bob, groot, muse, groq, dots, pixie, tyler
sleepy cloud, angry wasp, a tiny round pebble, razor wire, soft pillow, thunderbolt
a, ab, ?, 123, hello world, the quick brown fox jumps over the lazy dog
aaaaaa, kkkkkk, bbbbbb, tttttt, mnmnmn, ztztzt, oooooo, iiiiii
`.trim();

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const wordsEl = $<HTMLTextAreaElement>("words");
const moodEl = $<HTMLSelectElement>("mood");
const paletteEl = $<HTMLSelectElement>("palette");
const scaleEl = $<HTMLInputElement>("scale");
const animateEl = $<HTMLInputElement>("animate");
const styleEl = $<HTMLSelectElement>("style");
const smoothnessEl = $<HTMLInputElement>("smoothness");
const gridEl = $("grid");
const statsEl = $("stats");

for (const m of MOODS) moodEl.append(new Option(m, m));
wordsEl.value = new URLSearchParams(location.hash.slice(1)).get("w") ?? DEFAULT_WORDS;

const behaviors = new Map<string, Behavior>();
const bar = (label: string, v: number): string =>
  `<span>${label}</span><i style="width:${v}%"></i>`;

function art(grid: Uint8Array, colors: string[], px: number, label: string): string {
  const pixel = toSVG(grid, colors, { size: px, label });
  const smooth = toSmoothSVG(grid, colors, { size: px, label, smoothness: Number(smoothnessEl.value) });
  return styleEl.value === "pixel" ? pixel : styleEl.value === "smooth" ? smooth : pixel + smooth;
}

function render(): void {
  const words = wordsEl.value.split(/[,\n]/).map((w) => w.trim()).filter((w, i, a) => w !== "" && a.indexOf(w) === i);
  const preset = (paletteEl.value || undefined) as PresetName | undefined;
  const px = Number(scaleEl.value) * 16;
  const seen = new Map<string, number>();
  // One word: show it in every mood. Several words: show them all in the chosen mood.
  const jobs: Array<[string, Mood]> =
    words.length === 1 ? MOODS.map((m) => [words[0]!, m]) : words.map((w) => [w, moodEl.value as Mood]);
  const cards = jobs.map(([w, mood]) => {
    const s = generate(w, { palette: preset });
    const animated = animateEl.checked;
    if (!animated) behaviors.clear();
    // Animated cards use the real behavior engine: each shape has its own idle motion, blinks and jumps.
    let pose: Parameters<typeof compose>[1] = { mood };
    if (animated) {
      const key = `${w}|${preset ?? ""}`;
      let b = behaviors.get(key);
      if (!b) {
        b = createBehavior({ seed: s.seed, traits: s.traits, template: s.template, sleepAfterMs: 0 });
        behaviors.set(key, b);
      }
      const p = b.tick(0);
      pose = { ...p, mood: words.length === 1 ? mood : p.mood };
    }
    const grid = compose(s, pose);
    const key = s.grid.join("");
    seen.set(key, (seen.get(key) ?? 0) + 1);
    const t = s.traits;
    return `<div class="card" title="${normalize(w)}">
      <div class="pair">${art(grid, s.colors, px, describe(s))}</div>
      <div class="word">${w.replace(/</g, "&lt;")}${words.length === 1 ? ` · ${mood}` : ""}</div>
      <div class="tr">${s.template} · ${s.eyeStyle} · ${s.colorName}</div>
      <div class="bar">${bar("round", t.roundness)}${bar("heft", t.heft)}${bar("energy", t.energy)}${bar("chaos", t.chaos)}</div>
    </div>`;
  });
  gridEl.style.setProperty("--cw", `${Math.max(150, (styleEl.value === "both" ? px * 2 + 12 : px) + 24)}px`);
  gridEl.innerHTML = cards.join("");
  statsEl.textContent = words.length === 1 ? "all moods" : `${words.length} words, ${seen.size} distinct sprites`;
}

for (const el of [wordsEl, moodEl, paletteEl, scaleEl, animateEl, styleEl, smoothnessEl]) el.addEventListener("input", render);
wordsEl.addEventListener("input", () => history.replaceState(null, "", `#w=${encodeURIComponent(wordsEl.value)}`));
setInterval(() => {
  if (animateEl.checked) {
    for (const b of behaviors.values()) b.tick(100);
    render();
  }
}, 100);
render();
