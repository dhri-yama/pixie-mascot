// Spec: spec/sprite.md "Faces". Draws a mood onto the faceless body. Pure and integer-only.

import facesData from "../../../spec/faces/faces.json";
import { ACCENT, CLEAR, INK, SIZE, WHITE, type Grid, type Pose, type Sprite } from "./types";

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

  // Eyes: the right eye is the mirror image of the left; gaze moves both the same way.
  const pattern = EYES[sprite.eyeStyle]?.[pose.blink ? "blink" : mood] ?? [];
  const lx = 7 - eyeInner - 2;
  const rx = 8 + eyeInner;
  for (const pass of ["fixed", "pupil"] as const) {
    for (let i = 0; i < pattern.length; i++) {
      const row = pattern[i] ?? "";
      for (let j = 0; j < row.length; j++) {
        const ch = row[j] ?? ".";
        if (ch === ".") continue;
        const isPupil = ch === "p";
        if ((pass === "pupil") !== isPupil) continue;
        const ox = isPupil ? gx : 0;
        const oy = isPupil ? gy : 0;
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
    const x0 = 8 - row.length / 2;
    for (let j = 0; j < row.length; j++) {
      const ch = row[j] ?? ".";
      if (ch !== "." && at(g, x0 + j, mouthY + i) !== CLEAR) put(g, x0 + j, mouthY + i, COLOR[ch] ?? INK);
    }
  }

  // Bob: shift everything up one pixel. Row 0 is always empty, so nothing is lost.
  if (pose.bob) {
    g.copyWithin(0, SIZE, SIZE * SIZE);
    g.fill(CLEAR, SIZE * (SIZE - 1));
  }

  // Props float in the top-right corner and ignore the body.
  const prop = PROPS[mood];
  if (prop) {
    for (let i = 0; i < prop.rows.length; i++) {
      const row = prop.rows[i] ?? "";
      for (let j = 0; j < row.length; j++) if (row[j] !== ".") put(g, prop.x + j, prop.y + i, INK);
    }
  }
  return g;
}
