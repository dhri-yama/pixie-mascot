// Spec: spec/sprite.md. Text -> Sprite. Pure function of (text, version, palette preset).
// The order of rng draws below is part of the algorithm: never reorder or add draws once v1 is frozen.
//
// Geometry (32x32 grid): the left half is columns 0..15 and is mirrored onto 16..31. The body sits on the
// ground (its last row is 25), feet use rows 26..29, row 30 is outline. Rows 0..3 are kept free for parts
// that stick up, the outline above them, and the idle bob.

import partsData from "../../../spec/parts/parts.json";
import paletteData from "../../../spec/palettes.json";
import { normalize } from "./normalize";
import { hashText } from "./hash";
import { createRng } from "./rng";
import { clamp, computeTraits, idiv } from "./traits";
import { compose } from "./compose";
import {
  ACCENT, AXIS, BODY, CLEAR, GROUND, LIGHT, OUTLINE, SHADE, SIZE, TOP, VERSION,
  type Anchors, type EyeStyle, type GenerateOptions, type Grid, type Sprite, type Template,
} from "./types";

interface Part {
  id: string;
  slot: "top" | "side" | "bottom";
  tone: "soft" | "sharp";
  dx: number[];
  rows: string[];
}
const PARTS = partsData.parts as Part[];
const PART_VALUE: Record<string, number> = { "#": BODY, a: ACCENT, d: SHADE, l: LIGHT };

const at = (g: Grid, x: number, y: number): number =>
  x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : (g[y * SIZE + x] ?? 0);
const put = (g: Grid, x: number, y: number, v: number): void => {
  if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) g[y * SIZE + x] = v;
};
const putIfEmpty = (g: Grid, x: number, y: number, v: number): void => {
  if (at(g, x, y) === CLEAR) put(g, x, y, v);
};

function topOf(g: Grid, x: number): number {
  for (let y = 0; y < SIZE; y++) if (at(g, x, y) !== CLEAR) return y;
  return -1;
}
function bottomOf(g: Grid, x: number): number {
  for (let y = SIZE - 1; y >= 0; y--) if (at(g, x, y) !== CLEAR) return y;
  return -1;
}
function leftOf(g: Grid, y: number): number {
  for (let x = 0; x < SIZE; x++) if (at(g, x, y) !== CLEAR) return x;
  return -1;
}

function bodyCell(t: Template, c: number, r: number, half: number, bh: number, k: number, halfTop: number): boolean {
  const bw = half * 2;
  const dx = (half - c) * 2 - 1;
  const dy = 2 * r + 1 - bh;
  switch (t) {
    case "blob":
      return dx * dx * bh * bh + dy * dy * bw * bw <= bw * bw * bh * bh;
    case "gem":
      return dx * bh + Math.abs(dy) * bw <= bw * bh;
    case "box":
      return c + Math.min(r, bh - 1 - r) >= k || c >= k || Math.min(r, bh - 1 - r) >= k;
    case "wedge":
      return half - c <= halfTop + idiv((half - halfTop) * r, bh - 1);
  }
}

interface PartRolls {
  present: number;
  tone: number;
  part: number;
  dx: number;
  row: number;
}

function placePart(g: Grid, part: Part, rolls: PartRolls, y0: number, bh: number, half: number): void {
  const h = part.rows.length;
  const w = (part.rows[0] ?? "").length;
  const cell = (i: number, j: number): number => PART_VALUE[part.rows[i]?.[j] ?? "."] ?? 0;
  const xl = AXIS + 1 - half;

  if (part.slot === "top") {
    const dx = part.dx[rolls.dx % part.dx.length] ?? 0;
    const ax = AXIS - dx;
    if (ax < xl || topOf(g, ax) < 0) return;
    const yb = topOf(g, ax) - 1;
    for (let i = 0; i < h; i++) {
      const y = yb - (h - 1) + i;
      if (y < TOP) continue;
      for (let j = 0; j < w; j++) {
        const x = ax - (w - 1) + j;
        const v = cell(i, j);
        if (v !== 0 && x >= 1) putIfEmpty(g, x, y, v);
      }
    }
    // Roots: stretch each column down to the body so nothing floats.
    for (let j = 0; j < w; j++) {
      const x = ax - (w - 1) + j;
      let lowest = -1;
      for (let i = 0; i < h; i++) if (cell(i, j) !== 0 && yb - (h - 1) + i >= TOP) lowest = yb - (h - 1) + i;
      if (lowest < 0 || x < 1) continue;
      for (let y = lowest + 1, n = 0; y < SIZE && n < 8 && at(g, x, y) === CLEAR; y++, n++) put(g, x, y, BODY);
    }
  } else if (part.slot === "side") {
    const ys = y0 + 4 + (rolls.row % Math.max(1, bh - 8));
    const lx = leftOf(g, ys);
    if (lx < 0) return;
    const xr = lx - 1;
    if (xr - (w - 1) < 1) return;
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        const v = cell(i, j);
        if (v !== 0) putIfEmpty(g, xr - (w - 1) + j, ys + i, v);
      }
      // Reach back to the body on this row.
      let rightmost = -1;
      for (let j = 0; j < w; j++) if (cell(i, j) !== 0) rightmost = xr - (w - 1) + j;
      for (let x = rightmost + 1, n = 0; rightmost >= 0 && x <= AXIS && n < 6 && at(g, x, ys + i) === CLEAR; x++, n++) {
        put(g, x, ys + i, BODY);
      }
    }
  } else {
    const dx = part.dx[rolls.dx % part.dx.length] ?? 0;
    const ax = AXIS - dx;
    if (ax < xl) return;
    const yb = bottomOf(g, ax);
    if (yb < 0) return;
    for (let i = 0; i < h; i++) {
      const y = yb + 1 + i;
      if (y > GROUND + 4) continue;
      for (let j = 0; j < w; j++) {
        const x = ax - (w - 1) + j;
        const v = cell(i, j);
        if (v !== 0 && x >= 1) putIfEmpty(g, x, y, v);
      }
    }
    // Stretch each column up to the body.
    for (let j = 0; j < w; j++) {
      const x = ax - (w - 1) + j;
      let top = -1;
      for (let i = h - 1; i >= 0; i--) if (cell(i, j) !== 0 && yb + 1 + i <= GROUND + 4) top = yb + 1 + i;
      if (top < 0 || x < 1) continue;
      for (let y = top - 1, n = 0; y >= 0 && n < 6 && at(g, x, y) === CLEAR; y--, n++) put(g, x, y, BODY);
    }
  }
}

function pickPart(slot: Part["slot"], wantSoft: boolean, rolls: PartRolls, chaos: number): Part | undefined {
  const flip = rolls.tone < 20 + idiv(chaos, 5);
  const soft = flip ? !wantSoft : wantSoft;
  const pool = PARTS.filter((p) => p.slot === slot && p.tone === (soft ? "soft" : "sharp"));
  return pool[rolls.part % pool.length];
}

/**
 * Pick the widest eye spacing (at most `pref`, at least 1) whose left eye sits fully on the body,
 * moving the eyes down up to four rows when the body is too narrow at the preferred row.
 * The eye box is 6x6; a "dot" eye only needs its lower-right 4x4 on the body.
 */
function fitEyes(fill: Grid, style: EyeStyle, eyeY0: number, pref: number): { eyeY: number; eyeInner: number } {
  const offsets = style === "big" ? [0, 1, 2, 3, 4, 5] : [2, 3, 4, 5];
  // First try to keep one body pixel between the eye and the edge, then settle for touching it.
  for (const margin of [1, 0]) {
    for (let dy = 0; dy <= 4; dy++) {
      for (let ei = pref; ei >= 1; ei--) {
        const lx = AXIS - ei - 5;
        let ok = true;
        for (const r of offsets) {
          for (const c of offsets) if (at(fill, lx + c, eyeY0 + dy + r) === CLEAR) ok = false;
          if (margin === 1 && at(fill, lx + offsets[0]! - 1, eyeY0 + dy + r) === CLEAR) ok = false;
        }
        if (ok) return { eyeY: eyeY0 + dy, eyeInner: ei };
      }
    }
  }
  return { eyeY: eyeY0, eyeInner: 1 };
}

export function generate(text: string, options: GenerateOptions = {}): Sprite {
  const version = options.version ?? VERSION;
  if (version !== VERSION) throw new RangeError(`Unsupported Pixie algorithm version: ${version}`);

  const norm = normalize(text);
  const seed = hashText(norm);
  const rng = createRng(seed);

  const traits = computeTraits(norm, rng);
  const { roundness, heft, energy, chaos } = traits;

  // Body shape.
  const eff = clamp(roundness + (rng.int(15) - 7));
  const heightRoll = rng.int(3);
  const chamferRoll = rng.int(3);
  const wedgeRoll = rng.int(3);
  const template: Template = eff >= 68 ? "blob" : eff >= 45 ? "box" : eff >= 25 ? "wedge" : "gem";
  const half = 8 + idiv(heft * 5, 100); // 8..13 columns on the left side: 16..26 wide
  const bh = 17 - idiv(heft * 5, 100) - heightRoll; // 10..17 rows tall
  const y0 = GROUND - bh + 1;
  const xl = AXIS + 1 - half;
  const k = 2 + chamferRoll; // chamfer size of the box
  const halfTop = Math.min(half, 3 + wedgeRoll); // half width at the top of the wedge

  const g: Grid = new Uint8Array(SIZE * SIZE);
  for (let r = 0; r < bh; r++) {
    for (let c = 0; c < half; c++) {
      if (bodyCell(template, c, r, half, bh, k, halfTop)) put(g, xl + c, y0 + r, BODY);
    }
  }

  // Parts. Every slot always draws the same five numbers.
  const draw = (): PartRolls => ({
    present: rng.int(100),
    tone: rng.int(100),
    part: rng.next(),
    dx: rng.next(),
    row: rng.next(),
  });
  const rTop = draw(), rSide = draw(), rBottom = draw(), rTop2 = draw();
  const wantSoft = eff >= 50;
  const plan: Array<[Part["slot"], PartRolls, number]> = [
    ["top", rTop, 70],
    ["side", rSide, 30 + idiv(energy, 3)],
    ["bottom", rBottom, 80],
    ["top", rTop2, energy >= 60 ? 60 : 0],
  ];
  for (const [slot, rolls, chance] of plan) {
    if (rolls.present >= chance) continue;
    const part = pickPart(slot, wantSoft, rolls, chaos);
    if (part) placePart(g, part, rolls, y0, bh, half);
  }

  // Mirror left half onto the right half.
  for (let y = 0; y < SIZE; y++) for (let x = 0; x <= AXIS; x++) put(g, SIZE - 1 - x, y, at(g, x, y));

  // Chaos breaks symmetry.
  const mutations = idiv(chaos, 25);
  for (let m = 0; m < mutations; m++) {
    const typeRoll = rng.next();
    const pickRoll = rng.next();
    const cands: number[] = [];
    const chip = typeRoll % 2 === 0;
    for (let y = TOP; y < GROUND + 5; y++) {
      for (let x = AXIS + 1; x < SIZE; x++) {
        const v = at(g, x, y);
        if (chip) {
          const edge = at(g, x - 1, y) === 0 || at(g, x + 1, y) === 0 || at(g, x, y - 1) === 0 || at(g, x, y + 1) === 0;
          if (v === BODY && edge && at(g, x, y - 1) === 0) cands.push(y * SIZE + x);
        } else if (v === CLEAR && at(g, x, y + 1) === BODY && at(g, x, y - 1) === 0) {
          cands.push(y * SIZE + x);
        }
      }
    }
    const idx = cands[pickRoll % Math.max(1, cands.length)];
    if (idx !== undefined) g[idx] = chip ? CLEAR : BODY;
  }

  // Shade the bottom two rows of every downward-facing edge, add a three-pixel shine, then outline.
  // Each pass reads a snapshot.
  const snap1 = g.slice();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (at(snap1, x, y) === BODY && (at(snap1, x, y + 1) === CLEAR || at(snap1, x, y + 2) === CLEAR)) put(g, x, y, SHADE);
    }
  }
  scan: for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (
        at(g, x, y) === BODY && at(g, x + 1, y) === BODY && at(g, x + 2, y) === BODY &&
        at(g, x, y + 1) === BODY && at(g, x + 1, y + 1) === BODY && at(g, x, y + 2) === BODY &&
        at(g, x - 1, y) !== CLEAR
      ) {
        put(g, x, y, LIGHT);
        put(g, x + 1, y, LIGHT);
        put(g, x, y + 1, LIGHT);
        break scan;
      }
    }
  }
  const snap2 = g.slice();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (at(snap2, x, y) !== CLEAR) continue;
      if (at(snap2, x - 1, y) || at(snap2, x + 1, y) || at(snap2, x, y - 1) || at(snap2, x, y + 1)) put(g, x, y, OUTLINE);
    }
  }

  // Face anchors.
  const eyeInnerRoll = rng.int(3);
  const eyeStyleRoll = rng.int(40);
  const eyeStyle: EyeStyle = clamp(roundness + eyeStyleRoll - 20) >= 50 ? "big" : "dot";
  const fit = fitEyes(
    snap2,
    eyeStyle,
    y0 + idiv(bh * 30, 100) + (template === "gem" ? 2 : 0),
    2 + eyeInnerRoll + (half >= 11 ? 2 : 0),
  );
  const anchors: Anchors = {
    eyeY: fit.eyeY,
    eyeInner: fit.eyeInner,
    mouthY: Math.min(fit.eyeY + 8, y0 + bh - 4),
  };

  // Colors.
  const entryRoll = rng.next();
  const group = energy >= 60 ? "vivid" : roundness >= 50 ? "pastel" : "deep";
  const pool = paletteData.groups[group];
  const entry = pool[entryRoll % pool.length]!;
  let colors = ["", entry.body, entry.outline, entry.shade, entry.light, entry.accent, entry.outline, paletteData.white];
  let colorName = entry.name;
  if (options.palette) {
    const p = paletteData.presets[options.palette];
    colors = ["", p[2]!, p[0]!, p[1]!, p[3]!, p[2]!, p[0]!, p[3]!];
    colorName = options.palette;
  }

  const sprite: Sprite = {
    version, seed, text: norm, traits, template, eyeStyle, anchors,
    body: g, grid: g, colors, colorName,
  };
  sprite.grid = compose(sprite, { mood: "neutral" });
  return sprite;
}

export function describe(sprite: Sprite): string {
  const shape = { blob: "round", box: "boxy", wedge: "wedge-shaped", gem: "crystal-shaped" }[sprite.template];
  const e = sprite.traits.energy;
  const mood = e < 35 ? "calm" : e < 65 ? "lively" : "hyper";
  return `A ${shape}, ${mood} ${sprite.colorName} pixel mascot`;
}
