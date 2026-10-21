// Spec: spec/sprite.md "Faces". Draws a mood onto the faceless body. Pure and integer-only.

import facesData from "../../../spec/faces/faces.json";
import { idiv } from "./traits";
import { ACCENT, AXIS, CLEAR, INK, MAX_LIFT, SIZE, WHITE, type Grid, type Pose, type Sprite } from "./types";

type EyeSet = Record<string, string[]>;
const EYES = facesData.eyes as unknown as Record<string, EyeSet>;
const MOUTHS = facesData.mouths as unknown as Record<string, string[]>;
const PROPS = facesData.props as unknown as Record<string, { x: number; y: number; rows: string[] } | null>;

const at = (g: Grid, x: number, y: number): number =>
  x < 0 || y < 0 || x >= SIZE || y >= SIZE ? 0 : (g[y * SIZE + x] ?? 0);
const put = (g: Grid, x: number, y: number, v: number): void => {
  if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) g[y * SIZE + x] = v;
};

const COLOR: Record<string, number> = { k: INK, p: INK, w: WHITE, a: ACCENT };

/** Returns a new grid: the sprite's body with the pose's face drawn on it. */
export function compose(sprite: Sprite, pose: Pose = {}): Grid {
  const mood = pose.mood ?? "neutral";
  const gx = pose.gaze?.x ?? 0;
  const gy = pose.gaze?.y ?? 0;
  const g: Grid = sprite.body.slice();
  const { eyeY, eyeInner, mouthY } = sprite.anchors;

  // Eyes: the right eye is the mirror image of the left; gaze moves both pupils the same way, two pixels per step.
  const pattern = EYES[sprite.eyeStyle]?.[pose.blink ? "blink" : mood] ?? [];
  const lx = AXIS - eyeInner - 5;
  const rx = AXIS + 1 + eyeInner;
  for (const pass of ["fixed", "pupil"] as const) {
    for (let i = 0; i < pattern.length; i++) {
      const row = pattern[i] ?? "";
      for (let j = 0; j < row.length; j++) {
        const ch = row[j] ?? ".";
        if (ch === ".") continue;
        const isPupil = ch === "p";
        if ((pass === "pupil") !== isPupil) continue;
        const ox = isPupil ? gx * 2 : 0;
        const oy = isPupil ? gy * 2 : 0;
        const y = eyeY + i + oy;
        for (const x of [lx + j + ox, rx + (row.length - 1 - j) + ox]) {
          if (at(g, x, y) !== CLEAR) put(g, x, y, COLOR[ch] ?? INK);
        }
      }
    }
  }

  // Mouth, centered.
  const mouth = MOUTHS[mood] ?? [];
  for (let i = 0; i < mouth.length; i++) {
    const row = mouth[i] ?? "";
    const x0 = AXIS + 1 - row.length / 2;
    for (let j = 0; j < row.length; j++) {
      const ch = row[j] ?? ".";
      if (ch !== "." && at(g, x0 + j, mouthY + i) !== CLEAR) put(g, x0 + j, mouthY + i, COLOR[ch] ?? INK);
    }
  }

  // Motion: squash and stretch, lean, wave, shift and lift, applied to the whole mascot (face included).
  const moved = applyMotion(g, pose);

  // Props float in the top-right corner in the accent color so they show on any background.
  const prop = PROPS[mood];
  if (prop) {
    for (let i = 0; i < prop.rows.length; i++) {
      const row = prop.rows[i] ?? "";
      for (let j = 0; j < row.length; j++) if (row[j] !== ".") put(moved, prop.x + j, prop.y + i, ACCENT);
    }
  }
  return moved;
}

/** A sideways ripple, in columns, for eight rows in a row. Rows are offset by the wave phase. */
const WAVE = [0, 1, 1, 0, 0, -1, -1, 0];

const clampInt = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Moves the whole picture. Integer only, so every platform agrees.
 * 1. squash > 0 presses the body shorter, < 0 stretches it taller, keeping its feet on the same row;
 * 2. each row is shifted sideways by lean (more at the top), the wave, and dx;
 * 3. everything is lifted by `lift` rows. The top rows are always empty, so nothing is lost.
 */
export function applyMotion(g: Grid, pose: Pose): Grid {
  const squash = clampInt(pose.squash ?? 0, -3, 3);
  const lean = clampInt(pose.lean ?? 0, -3, 3);
  const dx = clampInt(pose.dx ?? 0, -3, 3);
  const lift = clampInt(pose.lift ?? 0, 0, MAX_LIFT);
  const amp = clampInt(pose.amp ?? 0, 0, 2);
  const wave = (pose.wave ?? 0) & 7;
  if (squash === 0 && lean === 0 && dx === 0 && lift === 0 && amp === 0) return g;

  let top = -1, bot = -1;
  for (let y = 0; y < SIZE && top < 0; y++) for (let x = 0; x < SIZE; x++) if (g[y * SIZE + x] !== CLEAR) { top = y; break; }
  for (let y = SIZE - 1; y >= 0 && bot < 0; y--) for (let x = 0; x < SIZE; x++) if (g[y * SIZE + x] !== CLEAR) { bot = y; break; }
  if (top < 0) return g;

  let cur = g;
  if (squash !== 0) {
    const h = bot - top + 1;
    const nh = clampInt(h - squash, 4, bot + 1); // cannot grow above the top of the picture
    const out: Grid = new Uint8Array(SIZE * SIZE);
    for (let i = 0; i < nh; i++) {
      const src = top + idiv(i * h, nh);
      const dst = bot - (nh - 1) + i;
      for (let x = 0; x < SIZE; x++) out[dst * SIZE + x] = cur[src * SIZE + x]!;
    }
    cur = out;
    top = bot - nh + 1;
  }

  const span = Math.max(1, bot - top);
  const out: Grid = new Uint8Array(SIZE * SIZE);
  for (let y = top; y <= bot; y++) {
    const shift = idiv(lean * (bot - y), span) + WAVE[(y + wave) & 7]! * amp + dx;
    const ny = y - lift;
    if (ny < 0) continue;
    for (let x = 0; x < SIZE; x++) {
      const v = cur[y * SIZE + x]!;
      const nx = x + shift;
      if (v !== CLEAR && nx >= 0 && nx < SIZE) out[ny * SIZE + nx] = v;
    }
  }
  return out;
}
