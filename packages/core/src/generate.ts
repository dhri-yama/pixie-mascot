// Spec: spec/sprite.md. Text -> Sprite. Pure function of (text, version, palette preset).
// The order of rng draws below is part of the algorithm: never reorder or add draws in v1.

import partsData from "../../../spec/parts/parts.json";
import paletteData from "../../../spec/palettes.json";
import { normalize } from "./normalize";
import { hashText } from "./hash";
import { createRng } from "./rng";
import { clamp, computeTraits, idiv } from "./traits";
import { compose } from "./compose";
import {
  ACCENT, BODY, CLEAR, LIGHT, OUTLINE, SHADE, SIZE, VERSION,
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
      return c + Math.min(r, bh - 1 - r) >= k || (c >= k) || Math.min(r, bh - 1 - r) >= k;
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
  const xl = 8 - half;

  if (part.slot === "top") {
    const dx = part.dx[rolls.dx % part.dx.length] ?? 0;
    const ax = 7 - dx;
    if (ax < xl || topOf(g, ax) < 0) return;
    const yb = topOf(g, ax) - 1;
    for (let i = 0; i < h; i++) {
      const y = yb - (h - 1) + i;
      if (y < 2) continue;
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
      for (let i = 0; i < h; i++) if (cell(i, j) !== 0 && yb - (h - 1) + i >= 2) lowest = yb - (h - 1) + i;
      if (lowest < 0 || x < 1) continue;
      for (let y = lowest + 1, n = 0; y < SIZE && n < 4 && at(g, x, y) === CLEAR; y++, n++) put(g, x, y, BODY);
    }
  } else if (part.slot === "side") {
    const ys = y0 + 2 + (rolls.row % Math.max(1, bh - 3));
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
      for (let x = rightmost + 1, n = 0; rightmost >= 0 && x <= 7 && n < 3 && at(g, x, ys + i) === CLEAR; x++, n++) {
        put(g, x, ys + i, BODY);
      }
    }
  } else {
    const dx = part.dx[rolls.dx % part.dx.length] ?? 0;
    const ax = 7 - dx;
    if (ax < xl) return;
    const yb = bottomOf(g, ax);
    if (yb < 0) return;
    for (let i = 0; i < h; i++) {
      const y = yb + 1 + i;
      if (y > 14) continue;
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
      for (let i = h - 1; i >= 0; i--) if (cell(i, j) !== 0 && yb + 1 + i <= 14) top = yb + 1 + i;
      if (top < 0 || x < 1) continue;
      for (let y = top - 1, n = 0; y >= 0 && n < 3 && at(g, x, y) === CLEAR; y--, n++) put(g, x, y, BODY);
    }
  }
}

function pickPart(slot: Part["slot"], wantSoft: boolean, rolls: PartRolls, chaos: number): Part | undefined {
  const flip = rolls.tone < 20 + idiv(chaos, 5);
  const soft = flip ? !wantSoft : wantSoft;
  const pool = PARTS.filter((p) => p.slot === slot && p.tone === (soft ? "soft" : "sharp"));
  return pool[rolls.part % pool.length];
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
  const heightRoll = rng.int(2);
  const chamferRoll = rng.int(2);
  const wedgeRoll = rng.int(2);
  const template: Template = eff >= 68 ? "blob" : eff >= 45 ? "box" : eff >= 25 ? "wedge" : "gem";
  const sizeIdx = heft < 34 ? 0 : heft < 67 ? 1 : 2;
  const half = 4 + sizeIdx;
  const bh = [9, 8, 7][sizeIdx]! - heightRoll;
  const y0 = 13 - bh;
  const xl = 8 - half;
  const k = 1 + chamferRoll;
  const halfTop = Math.min(half, 1 + wedgeRoll);

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
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < 8; x++) put(g, 15 - x, y, at(g, x, y));

  // Chaos breaks symmetry.
  const mutations = idiv(chaos, 25);
  for (let m = 0; m < mutations; m++) {
    const typeRoll = rng.next();
    const pickRoll = rng.next();
    const cands: number[] = [];
    const chip = typeRoll % 2 === 0;
    for (let y = 2; y < 15; y++) {
      for (let x = 8; x < 16; x++) {
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

  // Shade bottoms, one highlight pixel, then outline. Each pass reads a snapshot.
  const snap1 = g.slice();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (at(snap1, x, y) === BODY && at(snap1, x, y + 1) === CLEAR) put(g, x, y, SHADE);
    }
  }
  scan: for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (at(g, x, y) === BODY && at(g, x + 1, y) === BODY && at(g, x, y + 1) === BODY && at(g, x - 1, y) !== CLEAR) {
        put(g, x, y, LIGHT);
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
  const eyeInnerRoll = rng.int(2);
  const eyeStyleRoll = rng.int(40);
  const eyeY = y0 + idiv(bh * 30, 100) + (template === "gem" ? 1 : 0);
  const anchors: Anchors = {
    eyeY,
    eyeInner: 1 + eyeInnerRoll + (half === 6 ? 1 : 0),
    mouthY: Math.min(eyeY + 4, y0 + bh - 2),
  };
  const eyeStyle: EyeStyle = clamp(roundness + eyeStyleRoll - 20) >= 50 ? "big" : "dot";

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
