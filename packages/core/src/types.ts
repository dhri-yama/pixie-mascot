import type { Traits } from "./traits";

export const SIZE = 16;
export const VERSION = 1;
export type Grid = Uint8Array;
export type Template = "blob" | "box" | "wedge" | "gem";
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
