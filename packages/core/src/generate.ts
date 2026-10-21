// Spec: spec/sprite.md. Text -> Sprite. Pure function of (text, version, palette preset).
// The order of rng draws below is part of the algorithm: never reorder or add draws once v1 is frozen.
//
// Geometry (32x32 grid): the left half is columns 0..15 and is mirrored onto 16..31. The body sits on the
// ground (its last row is 25), feet use rows 26..29, row 30 is outline. Rows 0..3 are kept free for parts
// that stick up, the outline above them, and lifting. A tail is drawn after mirroring, on the right only.

import partsData from "../../../spec/parts/parts.json";
import paletteData from "../../../spec/palettes.json";
import { normalize } from "./normalize";
import { hashText } from "./hash";
import { createRng } from "./rng";
import { clamp, computeTraits, idiv } from "./traits";
import { compose } from "./compose";
import {
  ACCENT, AXIS, BODY, CLEAR, GROUND, LIGHT, OUTLINE, SHADE, SIZE, TOP, VERSION,
  type Anchors, type EyeStyle, type GenerateOptions, type Grid, type Mark, type Sprite, type Template,
} from "./types";

type Slot = "top" | "side" | "bottom" | "tail";
interface Part {
  id: string;
  slot: Slot;
  tone: "soft" | "sharp";
  dx: number[];
  rows: string[];
}
const PARTS = partsData.parts as Part[];
const PART_VALUE: Record<string, number> = { "#": BODY, a: ACCENT, d: SHADE, l: LIGHT };

/**
 * Body shapes. Round-sounding text picks from the soft list, sharp-sounding text from the sharp list, and text
 * full of hissing, slithering letters (s z x h w y l) often picks from the sinuous list: snakes and worms.
 */
const SOFT: Template[] = ["blob", "egg", "pear", "capsule", "dome", "cloud", "twin", "box", "mushroom", "bell", "drop", "jelly"];
const SHARP: Template[] = ["star", "gem", "wedge", "hex", "kite", "shield", "hourglass"];
const SINUOUS: Template[] = ["serpent", "cobra", "caterpillar"];
/** Where the eyes start, as a percent of the body height. */
const EYE_PCT: Record<Template, number> = {
  blob: 30, egg: 30, pear: 25, capsule: 25, dome: 35, cloud: 35, twin: 0, box: 30, mushroom: 25, bell: 45, drop: 50,
  jelly: 25, star: 40, gem: 40, wedge: 45, hex: 30, kite: 40, shield: 25, hourglass: 15, serpent: 0, cobra: 10, caterpillar: 8,
};

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
function rightOf(g: Grid, y: number): number {
  for (let x = SIZE - 1; x >= 0; x--) if (at(g, x, y) !== CLEAR) return x;
  return -1;
}

/** Integer square root, floor. Exact for the small numbers used here. */
function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

/** Half width, in cells, of row r of an ellipse that is `hw` cells wide on each side and `h` rows tall. */
function ellipseHw(r: number, hw: number, h: number): number {
  const t = 2 * r + 1 - h;
  return idiv(hw * isqrt(h * h - t * t) * 2 + h, 2 * h);
}

/** Half width of row i (from the end) of a round cap of radius ra. */
function capHw(i: number, ra: number): number {
  return idiv(isqrt((2 * i + 1) * (4 * ra - 2 * i - 1)) + 1, 2);
}

/** Widest of several ellipses stacked down the body. Each is [first row, height, half width]. */
function stackHw(r: number, segs: Array<[number, number, number]>): number {
  let v = 0;
  for (const [start, h, w] of segs) if (r >= start && r < start + h) v = Math.max(v, ellipseHw(r - start, w, h));
  return v;
}

/** Half width in cells for every body row. Each shape is a different silhouette; widths are clamped to 1..half. */
function rowWidths(t: Template, half: number, bh: number, k: number, halfTop: number): number[] {
  const w: number[] = [];
  const mid = (r: number): number => idiv(Math.abs(2 * r + 1 - bh) * half, bh); // distance from the middle row, in cells
  const sq = idiv(half * 55, 100);
  for (let r = 0; r < bh; r++) {
    let v: number;
    switch (t) {
      case "blob":
        v = ellipseHw(r, half, bh);
        break;
      case "egg":
        v = idiv(ellipseHw(r, half, bh) * (65 + idiv(35 * r, bh - 1)), 100);
        break;
      case "pear":
        v = idiv(ellipseHw(r, half, bh) * (30 + idiv(70 * r, bh - 1)), 100);
        break;
      case "capsule": {
        const ra = Math.min(half, idiv(bh, 2));
        v = r < ra ? half - ra + capHw(r, ra) : r >= bh - ra ? half - ra + capHw(bh - 1 - r, ra) : half;
        break;
      }
      case "dome": {
        const T = Math.max(4, idiv(bh * 60, 100));
        v = r < T ? idiv(half * isqrt((2 * r + 1) * (4 * T - 2 * r - 1)) + T, 2 * T) : half;
        break;
      }
      case "cloud": {
        const T = Math.max(4, idiv(bh * 70, 100));
        v = r < T ? idiv(half * isqrt((2 * r + 1) * (4 * T - 2 * r - 1)) + T, 2 * T) : half;
        break;
      }
      case "twin": {
        const rh = Math.max(5, idiv(half * 70, 100));
        const hh = Math.min(bh - 6, 2 * rh);
        const s = hh - 2;
        const head = r < hh ? ellipseHw(r, rh, hh) : 0;
        const body = r >= s ? ellipseHw(r - s, half, bh - s) : 0;
        v = Math.max(head, body);
        break;
      }
      case "box":
        v = half - Math.max(0, k - Math.min(r, bh - 1 - r));
        break;
      case "star": {
        const d = mid(r);
        v = Math.max(d <= sq ? sq : 0, half - d);
        break;
      }
      case "gem":
        v = half - mid(r);
        break;
      case "wedge":
        v = halfTop + idiv((half - halfTop) * r, bh - 1);
        break;
      case "hex": {
        const q = Math.max(2, idiv(bh, 3));
        v = r < q ? idiv(half * (r + 1), q) : r >= bh - q ? idiv(half * (bh - r), q) : half;
        break;
      }
      case "kite": {
        const s = Math.max(3, idiv(bh * 35, 100));
        v = r < s ? idiv(half * (r + 1), s) : idiv(half * (bh - r), bh - s);
        break;
      }
      case "mushroom": {
        const T = Math.max(4, idiv(bh * 55, 100));
        v = r < T ? idiv(half * isqrt((2 * r + 1) * (4 * T - 2 * r - 1)) + T, 2 * T) : Math.max(3, idiv(half * 40, 100));
        break;
      }
      case "jelly": {
        const T = Math.max(4, idiv(bh * 55, 100));
        v = r < T ? idiv(half * isqrt((2 * r + 1) * (4 * T - 2 * r - 1)) + T, 2 * T) : idiv(half * 85, 100);
        break;
      }
      case "bell": {
        const q = idiv(100 * r, bh - 1);
        v = idiv(half * (30 + idiv(70 * q * q, 10000)), 100);
        break;
      }
      case "drop": {
        const s = Math.max(3, idiv(bh * 45, 100));
        v = r < s ? idiv(half * (r + 1) * (r + 1), (s + 1) * (s + 1)) : ellipseHw(bh - s + (r - s), half, 2 * (bh - s));
        break;
      }
      case "shield": {
        const s = idiv(bh * 55, 100);
        v = r < s ? half - Math.max(0, 2 - r) : idiv(half * (bh - r), bh - s);
        break;
      }
      case "hourglass":
        v = idiv(half * (35 + idiv(65 * Math.abs(2 * r + 1 - bh), bh)), 100);
        break;
      case "cobra": {
        const b0 = idiv(bh * 42, 100), b1 = idiv(bh * 66, 100);
        v = stackHw(r, [
          [0, Math.max(5, idiv(bh * 40, 100)), half], // hood
          [idiv(bh * 30, 100), Math.max(3, idiv(bh * 20, 100) + 1), Math.max(3, idiv(half * 30, 100))], // neck
          [b0, Math.max(4, idiv(bh * 30, 100)), idiv(half * 80, 100)], // first coil
          [b1, bh - b1, idiv(half * 95, 100)], // second coil
        ]);
        break;
      }
      case "caterpillar": {
        const h = idiv(bh * 34, 100) + 1;
        v = stackHw(r, [
          [0, h, Math.max(6, idiv(half * 70, 100))], // head
          [idiv(bh * 22, 100), h, idiv(half * 85, 100)],
          [idiv(bh * 44, 100), h, half],
          [idiv(bh * 66, 100), h, idiv(half * 75, 100)],
        ]);
        break;
      }
      case "serpent":
        v = 1; // drawn from circles instead, see serpentCells
        break;
    }
    w.push(clamp(v, 1, half));
  }
  return w;
}

/** One period of a sine wave in sixteenths, 32 steps. Used for the coils of a snake. */
const SIN32 = [0, 3, 6, 9, 11, 13, 15, 16, 16, 16, 15, 13, 11, 9, 6, 3, 0, -3, -6, -9, -11, -13, -15, -16, -16, -16, -15, -13, -11, -9, -6, -3];

/** Fill a circle of radius r (in cells) centered on cell row cy, at doubled column c2x. */
function stamp(g: Grid, c2x: number, cy: number, r: number): void {
  const c2y = 2 * cy + 1;
  for (let y = cy - r - 1; y <= cy + r + 1; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = 2 * x + 1 - c2x;
      const dy = 2 * y + 1 - c2y;
      if (dx * dx + dy * dy <= 4 * r * r) put(g, x, y, BODY);
    }
  }
}

/**
 * A coiled snake: a round head on a short neck, resting on two stacked ring-shaped coils with holes you can see
 * through. Built from a chain of circles along two ellipses. Not mirrored from a half. Returns the head radius.
 */
function serpentCells(g: Grid, y0: number): number {
  const R0 = 5; // head radius
  stamp(g, SIZE, y0 + R0, R0);
  stamp(g, SIZE, y0 + R0 + 1, R0 - 1);
  for (let cy = y0 + R0 + 3; cy <= y0 + R0 + 5; cy++) stamp(g, SIZE, cy, 2); // neck
  const coil = (cy: number, rx: number, ry: number): void => {
    for (let j = 0; j < 32; j++) {
      stamp(g, SIZE + 2 * idiv(rx * SIN32[(j + 8) & 31]!, 16), cy + idiv(ry * SIN32[j]!, 16), 2);
    }
  };
  coil(GROUND - 10, 8, 3); // upper coil
  coil(GROUND - 4, 12, 4); // lower, wider coil
  return R0;
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
    // Slide inward until body lies under every column of the part (narrow tops, stars, snakes...), else skip it.
    let ax = Math.max(xl, AXIS - (part.dx[rolls.dx % part.dx.length] ?? 0));
    while (ax < AXIS && (topOf(g, ax) < 0 || topOf(g, ax - (w - 1)) < 0)) ax++;
    if (topOf(g, ax) < 0 || topOf(g, ax - (w - 1)) < 0) return;
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
  } else if (part.slot === "bottom") {
    let ax = Math.max(xl, AXIS - (part.dx[rolls.dx % part.dx.length] ?? 0));
    while (ax < AXIS && (bottomOf(g, ax) < 0 || bottomOf(g, ax - (w - 1)) < 0)) ax++;
    const yb = bottomOf(g, ax);
    if (yb < 0 || bottomOf(g, ax - (w - 1)) < 0) return;
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
  } else {
    // Tail: right side only. The bottom row sits on a body row in the lower half; the first column touches the body.
    const ys = y0 + idiv(bh * 55, 100) + (rolls.row % Math.max(1, idiv(bh * 30, 100)));
    const rx = rightOf(g, ys);
    if (rx < 0) return;
    const x0 = rx + 1;
    for (let i = 0; i < h; i++) {
      const y = ys - (h - 1) + i;
      if (y < TOP) continue;
      for (let j = 0; j < w; j++) {
        const v = cell(i, j);
        if (v !== 0 && x0 + j < SIZE - 1) putIfEmpty(g, x0 + j, y, v);
      }
      // Reach back to the body on this row.
      let leftmost = -1;
      for (let j = w - 1; j >= 0; j--) if (cell(i, j) !== 0) leftmost = x0 + j;
      for (let x = leftmost - 1, n = 0; leftmost >= 0 && x >= AXIS + 1 && n < 6 && at(g, x, y) === CLEAR; x--, n++) {
        put(g, x, y, BODY);
      }
    }
  }
}

/** Snakes are plain coils with at most a tail, cobras are plain, caterpillars get feelers and feet; everything else can have every part. */
function allows(t: Template, slot: Slot): boolean {
  if (t === "serpent") return slot === "tail";
  if (t === "cobra") return false;
  if (t === "caterpillar") return slot === "top" || slot === "bottom";
  return true;
}

function pickPart(slot: Slot, wantSoft: boolean, rolls: PartRolls, chaos: number): Part | undefined {
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

  // Body shape and proportions.
  const eff = clamp(roundness + (rng.int(15) - 7));
  const familyRoll = rng.int(100);
  const shapeRoll = rng.int(1000);
  const heightRoll = rng.int(3);
  const stretchRoll = rng.int(5);
  const widthRoll = rng.int(3);
  const leanRoll = rng.int(61) - 30;
  const chamferRoll = rng.int(3);
  const wedgeRoll = rng.int(3);
  // Hissing, slithering letters often make a snake or worm; a few other texts get one by chance.
  const sinuous = (traits.slink >= 30 && familyRoll < 70) || familyRoll < 4;
  const list = sinuous ? SINUOUS : eff >= 50 ? SOFT : SHARP;
  const template: Template = list[shapeRoll % list.length]!;
  // Heft says wide or tall, but a roll of its own keeps heavy-sounding words from all being flat blobs.
  // Pointy shapes cover less area, so they are drawn a little bigger.
  const lean = clamp(heft + leanRoll);
  const grow = template === "star" || template === "gem" || template === "kite" || template === "hex" ? 2 : template === "wedge" ? 1 : 0;
  const half = clamp(7 + idiv(lean * 6, 100) + widthRoll - 1 + grow, 7, 13); // 7..13 columns on the left side: 14..26 wide
  // A snake fills the whole height; everything else is 10..18 rows tall.
  const bh = template === "serpent" ? GROUND - TOP + 1 : clamp(18 - idiv(lean * 7, 100) - heightRoll + stretchRoll - 2, 10, 18);
  const y0 = GROUND - bh + 1;
  const xl = AXIS + 1 - half;
  const k = 2 + chamferRoll; // chamfer size of the box
  const halfTop = Math.min(half, 3 + wedgeRoll); // half width at the top of the wedge

  const g: Grid = new Uint8Array(SIZE * SIZE);
  // The head of a serpent is a circle, so its eyes have less room than a body of the same width.
  let eyeRoom = half;
  let serpentHead = 0;
  if (template === "serpent") {
    serpentHead = serpentCells(g, y0);
    eyeRoom = serpentHead;
  } else {
    const widths = rowWidths(template, half, bh, k, halfTop);
    const jellyTop = Math.max(4, idiv(bh * 55, 100));
    for (let r = 0; r < bh; r++) {
      for (let c = 0; c < half; c++) {
        // The cloud's lower edge is scalloped: every other group of three columns is three rows shorter.
        if (template === "cloud" && r >= bh - (c % 6 < 3 ? 0 : 3)) continue;
        // A jellyfish keeps only thin strands of different lengths under its dome.
        if (template === "jelly" && r >= jellyTop && !(c % 4 === 1 && r < bh - ((c * 5) % 4))) continue;
        if (half - c <= widths[r]!) {
          put(g, xl + c, y0 + r, BODY);
          put(g, SIZE - 1 - (xl + c), y0 + r, BODY);
        }
      }
    }
  }
  const bodyOnly = g.slice();

  // Parts. Every slot always draws the same five numbers.
  const draw = (): PartRolls => ({
    present: rng.int(100),
    tone: rng.int(100),
    part: rng.next(),
    dx: rng.next(),
    row: rng.next(),
  });
  const rTop = draw(), rSide = draw(), rBottom = draw(), rTop2 = draw(), rTail = draw();
  const wantSoft = eff >= 50;
  const plan: Array<[Slot, PartRolls, number]> = [
    ["top", rTop, 70],
    ["side", rSide, 30 + idiv(energy, 3)],
    ["bottom", rBottom, 80],
    ["top", rTop2, energy >= 60 ? 60 : 0],
  ];
  for (const [slot, rolls, chance] of plan) {
    if (rolls.present >= chance || !allows(template, slot)) continue;
    const part = pickPart(slot, wantSoft, rolls, chaos);
    if (part) placePart(g, part, rolls, y0, bh, half);
  }

  // Mirror the parts (placed on the left half) onto the right half. The body already has both sides.
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x <= AXIS; x++) {
      if (g[y * SIZE + x] !== bodyOnly[y * SIZE + x]) put(g, SIZE - 1 - x, y, at(g, x, y));
    }
  }

  // Marks. One decoration per mascot; always draw the same seven numbers. They only ever paint body pixels.
  const markRoll = rng.int(100);
  const mr = [rng.next(), rng.next(), rng.next(), rng.next(), rng.next(), rng.next()];
  const mark: Mark =
    markRoll < 25 ? "none" : markRoll < 45 ? "belly" : markRoll < 60 ? "spots" : markRoll < 72 ? "stripes" : markRoll < 88 ? "cheeks" : "gem";
  if (mark === "belly") {
    const rc = y0 + idiv(bh * 68, 100);
    const hh = Math.max(2, idiv(bh * 22, 100));
    const hwb = Math.max(3, idiv(half * 55, 100));
    for (let y = rc - hh; y <= rc + hh; y++) {
      for (let x = 0; x < SIZE; x++) {
        const dxc = x <= AXIS ? AXIS + 1 - x : x - AXIS;
        const dyy = y - rc;
        if (dxc * dxc * hh * hh + dyy * dyy * hwb * hwb <= hwb * hwb * hh * hh && at(g, x, y) === BODY) put(g, x, y, LIGHT);
      }
    }
  } else if (mark === "spots") {
    for (let i = 0; i < 3; i++) {
      const x = xl + 2 + (mr[2 * i]! % Math.max(1, half - 5));
      const y = y0 + 3 + (mr[2 * i + 1]! % Math.max(1, bh - 8));
      for (const sx of [x, SIZE - 2 - x]) {
        if (at(g, sx, y) === BODY && at(g, sx + 1, y) === BODY && at(g, sx, y + 1) === BODY && at(g, sx + 1, y + 1) === BODY) {
          put(g, sx, y, SHADE);
          put(g, sx + 1, y, SHADE);
          put(g, sx, y + 1, SHADE);
          put(g, sx + 1, y + 1, SHADE);
        }
      }
    }
  } else if (mark === "stripes") {
    const bands = 2 + (mr[0]! % 2);
    const gap = 2 + (mr[1]! % 2);
    for (let b = 0; b < bands; b++) {
      const yy = y0 + 3 + b * (2 + gap);
      for (let dy = 0; dy < 2; dy++) {
        for (let x = 0; x < SIZE; x++) if (at(g, x, yy + dy) === BODY) put(g, x, yy + dy, SHADE);
      }
    }
  }

  // A tail grows on the right side only, so it is the one thing that is not mirrored.
  if (rTail.present < 25 + idiv(chaos, 4) + idiv(energy, 5) && allows(template, "tail")) {
    const part = pickPart("tail", wantSoft, rTail, chaos);
    if (part) placePart(g, part, rTail, y0, bh, half);
  }

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

  // Face anchors. Narrow bodies cannot hold the big 6x6 eyes, so they get the small ones.
  const eyeInnerRoll = rng.int(3);
  const eyeStyleRoll = rng.int(40);
  const eyeStyle: EyeStyle = clamp(roundness + eyeStyleRoll - 20) >= 50 && eyeRoom >= 9 ? "big" : "dot";
  const eyeBase =
    template === "twin"
      ? idiv(Math.min(bh - 6, 2 * Math.max(5, idiv(half * 70, 100))) * 35, 100)
      : template === "serpent"
        ? Math.max(0, serpentHead - 3)
        : idiv(bh * EYE_PCT[template], 100);
  const fit = fitEyes(snap2, eyeStyle, y0 + eyeBase, 2 + eyeInnerRoll + (half >= 11 ? 2 : 0));
  const anchors: Anchors = {
    eyeY: fit.eyeY,
    eyeInner: fit.eyeInner,
    mouthY: Math.min(fit.eyeY + 8, y0 + bh - 4),
  };

  // Face marks sit relative to the eyes, so they are drawn once the eyes are placed. Only body pixels change.
  const paint = (x: number, y: number): void => {
    const v = at(g, x, y);
    if (v === BODY || v === SHADE || v === LIGHT) put(g, x, y, ACCENT);
  };
  if (mark === "cheeks") {
    const lx = AXIS - fit.eyeInner - 5;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        paint(lx + dx, fit.eyeY + 7 + dy);
        paint(SIZE - 1 - (lx + dx), fit.eyeY + 7 + dy);
      }
    }
  } else if (mark === "gem") {
    for (let dy = 0; dy < 2; dy++) for (let x = AXIS - 1; x <= AXIS + 2; x++) paint(x, fit.eyeY - 4 + dy);
  }

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
    version, seed, text: norm, traits, template, mark, eyeStyle, anchors,
    body: g, grid: g, colors, colorName,
  };
  sprite.grid = compose(sprite, { mood: "neutral" });
  return sprite;
}

const SHAPE_WORD: Record<Template, string> = {
  blob: "round", egg: "egg-shaped", pear: "pear-shaped", capsule: "capsule-shaped", dome: "dome-shaped",
  cloud: "cloudy", twin: "two-part", box: "boxy", mushroom: "mushroom-shaped", bell: "bell-shaped",
  drop: "drop-shaped", jelly: "jellyfish-like", star: "star-shaped", gem: "crystal-shaped",
  wedge: "wedge-shaped", hex: "hexagonal", kite: "kite-shaped", shield: "shield-shaped",
  hourglass: "hourglass-shaped", serpent: "snake-like", cobra: "cobra-like", caterpillar: "caterpillar-like",
};

export function describe(sprite: Sprite): string {
  const e = sprite.traits.energy;
  const mood = e < 35 ? "calm" : e < 65 ? "lively" : "hyper";
  return `A ${SHAPE_WORD[sprite.template]}, ${mood} ${sprite.colorName} pixel mascot`;
}
