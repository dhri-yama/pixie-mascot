import type { Traits } from "./traits";

export const SIZE = 32;
/** Last column of the left half. The mascot is mirrored around the line between AXIS and AXIS + 1. */
export const AXIS = 15;
/** Last row of the body. Feet use the rows below it. */
export const GROUND = 25;
/** First row parts may use. Rows above it hold the outline and leave room for the idle bob. */
export const TOP = 4;
/** Rows the idle bob lifts the mascot. */
export const BOB = 2;
export const VERSION = 1;
export type Grid = Uint8Array;
export type Template =
  | "blob" | "egg" | "pear" | "capsule" | "dome" | "cloud" | "twin" | "box"
  | "star" | "gem" | "wedge" | "hex" | "kite";
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
  /** Shift the whole mascot up one pixel (idle bob). */
  bob?: boolean;
}
