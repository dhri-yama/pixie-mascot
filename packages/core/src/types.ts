import type { Traits } from "./traits";

export const SIZE = 32;
/** Last column of the left half. The mascot is mirrored around the line between AXIS and AXIS + 1. */
export const AXIS = 15;
/** Last row of the body. Feet use the rows below it. */
export const GROUND = 25;
/** First row parts may use. Rows above it hold the outline and leave room for the idle bob. */
export const TOP = 4;
/** Most rows a motion may lift the mascot. Rows 0..TOP-1 are always empty, so nothing is lost. */
export const MAX_LIFT = 3;
export const VERSION = 1;
export type Grid = Uint8Array;
export type Template =
  | "blob" | "egg" | "pear" | "capsule" | "dome" | "cloud" | "twin" | "box"
  | "mushroom" | "bell" | "drop" | "jelly"
  | "star" | "gem" | "wedge" | "hex" | "kite" | "shield" | "hourglass"
  | "serpent" | "cobra" | "caterpillar";
export type Mark = "none" | "belly" | "spots" | "stripes" | "cheeks" | "gem";
export type EyeStyle = "dot" | "big";
export type PresetName = "gameboy" | "mono" | "amber";

/** Palette indices used in grids. */
export const CLEAR = 0, BODY = 1, OUTLINE = 2, SHADE = 3, LIGHT = 4, ACCENT = 5, INK = 6, WHITE = 7;

export interface Anchors {
  eyeY: number;
  eyeInner: number;
  mouthY: number;
}

export interface Sprite {
  version: number;
  seed: number;
  /** Normalized text this sprite was made from. */
  text: string;
  traits: Traits;
  template: Template;
  /** Decoration on the body: a belly patch, spots, stripes, cheeks or a forehead gem. */
  mark: Mark;
  eyeStyle: EyeStyle;
  anchors: Anchors;
  /** Body without a face. */
  body: Grid;
  /** Body with the neutral face. This is what the golden file hashes. */
  grid: Grid;
  /** 8 CSS colors indexed by palette index; index 0 is "" (clear). */
  colors: string[];
  colorName: string;
}

export interface GenerateOptions {
  version?: number;
  palette?: PresetName;
}

export const MOODS = ["neutral", "happy", "sad", "surprised", "thinking", "sleepy"] as const;
export type Mood = (typeof MOODS)[number];

export interface Gaze {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

export interface Pose {
  mood?: Mood;
  gaze?: Gaze;
  blink?: boolean;
  /** Rows the whole mascot is lifted (0..3). */
  lift?: number;
  /** Columns the whole mascot is shifted right (negative = left). */
  dx?: number;
  /** Tilt around the feet: positive leans right at the top (-3..3). */
  lean?: number;
  /** Positive presses the body shorter, negative stretches it taller (-3..3). */
  squash?: number;
  /** Phase (0..7) of a sideways wave that ripples down the body. */
  wave?: number;
  /** Size of that wave in columns (0..2). 0 means none. */
  amp?: number;
}
