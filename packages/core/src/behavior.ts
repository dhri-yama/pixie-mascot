// Spec: spec/behavior.md. Pure, seeded state machine: no DOM, no clock, no Math.random().
// The host calls tick(dtMs) and draws the returned Pose with compose(). Same seed + same calls = same poses.

import motionData from "../../../spec/motion.json";
import { createRng, type Rng } from "./rng";
import { clamp, idiv } from "./traits";
import type { Traits } from "./traits";
import type { Gaze, Mood, Pose, Template } from "./types";

export type Attention = "follow" | "wander" | "focus" | "asleep";
export type AttentionMode = "always" | "sometimes" | "never";
/** How a mascot idles. Chosen from its body shape. */
export type Motion = "bounce" | "sway" | "waddle" | "slither" | "float" | "pulse";

/** A direction from the mascot to something. Length ~1 means "far away". */
export interface Vec {
  x: number;
  y: number;
}

export interface BehaviorOptions {
  /** Use the sprite's seed so each mascot has its own rhythm. */
  seed: number;
  traits: Traits;
  /** The sprite's body shape. It decides how the mascot moves. Default "blob". */
  template?: Template;
  /** always = never looks away from the cursor, never = ignores it, sometimes = mixes both. */
  attention?: AttentionMode;
  /** No moving, no blinking, no wandering. Gaze still follows. */
  reducedMotion?: boolean;
  /** Idle time before falling asleep. 0 disables sleeping. Default 30000. */
  sleepAfterMs?: number;
}

export interface Behavior {
  /** Advance time and return the pose to draw. */
  tick(dtMs: number): Required<Pose>;
  /** Mood set by the app (loading, error...). Beats reactions and idle. null clears it. */
  setMood(mood: Mood | null): void;
  /** One-shot reaction that falls back to idle after `ms`. Wakes the mascot. */
  react(mood: Mood, ms?: number): void;
  /** Drop a running reaction right away (e.g. the pointer left the button that caused it). */
  clearReaction(): void;
  /** Where the cursor (or touch) is, relative to the mascot. null = unknown / left the window. */
  lookAt(target: Vec | null): void;
  /** Lock attention on something (a hovered button, the active input). Beats cursor following. */
  focus(target: Vec | null): void;
  /** Wake up and look startled. */
  poke(): void;
  setAttention(mode: AttentionMode): void;
  readonly attention: Attention;
  readonly mood: Mood;
  readonly motion: Motion;
}

/** Turn a direction into one of 8 gaze directions (or center). Deadzone keeps small offsets still. */
export function snapGaze(v: Vec, deadzone = 0.3): Gaze {
  const f = (n: number): -1 | 0 | 1 => (n > deadzone ? 1 : n < -deadzone ? -1 : 0);
  return { x: f(v.x), y: f(v.y) };
}

/** Which idle motion a body shape gets. Calm round shapes sway instead of bouncing. */
export function motionFor(template: Template, energy: number): Motion {
  switch (template) {
    case "serpent":
    case "cobra":
    case "caterpillar":
      return "slither";
    case "cloud":
    case "jelly":
      return "float";
    case "capsule":
    case "twin":
    case "box":
    case "shield":
    case "hourglass":
      return "waddle";
    case "star":
    case "gem":
    case "hex":
    case "kite":
    case "wedge":
      return "pulse";
    default:
      return energy >= 45 ? "bounce" : "sway";
  }
}

interface Style {
  lift: number[];
  dx: number[];
  lean: number[];
  squash: number[];
  wave: string;
  amp: number;
}
const STYLES = motionData.styles as unknown as Record<Motion, Style>;
const BREATHE = motionData.breathe.squash;
const JUMP = motionData.jump;

const WANDER_GAZES: Gaze[] = [
  { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
  { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 0 },
];

export function createBehavior(options: BehaviorOptions): Behavior {
  const { traits } = options;
  const rng: Rng = createRng((options.seed ^ 0x9e3779b9) | 0);
  const reduced = options.reducedMotion ?? false;
  const sleepAfter = options.sleepAfterMs ?? 30000;
  const motion = motionFor(options.template ?? "blob", traits.energy);
  const style = STYLES[motion];
  let mode: AttentionMode = options.attention ?? "sometimes";

  // Personality from traits (integers, milliseconds).
  const blinkMin = 4000 - traits.energy * 20; // energetic: blinks more often
  const stepMs = clamp(220 - idiv(traits.energy * 13, 10), 100, 220); // energetic: moves faster
  const gazeDelay = 80 + (100 - traits.energy) * 2; // calm: slower to react
  const span = 3000 + (100 - traits.chaos) * 40; // orderly: stays on the cursor longer
  const phase = rng.int(stepMs * 8);

  let now = 0;
  let lastActivity = 0;
  let asleep = false;
  let appMood: Mood | null = null;
  let reaction: { mood: Mood; until: number; start: number } | null = null;
  let target: Vec | null = null;
  let focusTarget: Vec | null = null;
  let attention: Attention = "follow";
  let attentionUntil = now + span + rng.int(3000);
  let wanderGaze: Gaze = { x: 0, y: 0 };
  let wanderAt = 0;
  let gaze: Gaze = { x: 0, y: 0 };
  let gazeAt = 0;
  let nextBlink = blinkMin + rng.int(1800);
  let blinkUntil = -1;
  let mood: Mood = "neutral";

  const touch = (): void => {
    lastActivity = now;
    asleep = false;
  };

  const chooseAttention = (): void => {
    if (asleep) {
      attention = "asleep";
      return;
    }
    if (focusTarget) {
      attention = "focus";
      return;
    }
    // Nothing to follow, or told not to: just look around.
    if (mode === "never" || !target) {
      attention = "wander";
      return;
    }
    if (mode === "always" || reduced) {
      attention = "follow";
      return;
    }
    // Cursor present, mode "sometimes": alternate between following and glancing away.
    if (attention !== "follow" && attention !== "wander") {
      attention = "follow";
      attentionUntil = now + span + rng.int(3000);
    } else if (now >= attentionUntil) {
      if (attention === "follow") {
        attention = "wander";
        attentionUntil = now + 1500 + rng.int(2500);
        wanderAt = now;
        wanderGaze = WANDER_GAZES[rng.int(WANDER_GAZES.length)]!;
      } else {
        attention = "follow";
        attentionUntil = now + span + rng.int(3000);
      }
    }
  };

  return {
    setMood(m) {
      appMood = m;
      if (m) touch();
    },
    react(m, ms = 900) {
      reaction = { mood: m, until: now + ms, start: now };
      touch();
    },
    clearReaction() {
      reaction = null;
    },
    lookAt(v) {
      const moved = v !== null && (target === null || Math.abs(v.x - target.x) + Math.abs(v.y - target.y) > 0.05);
      target = v;
      if (moved) touch();
    },
    focus(v) {
      focusTarget = v;
      if (v) touch();
    },
    poke() {
      reaction = { mood: "surprised", until: now + 700, start: now };
      touch();
    },
    setAttention(m) {
      mode = m;
    },
    get attention() {
      return attention;
    },
    get mood() {
      return mood;
    },
    get motion() {
      return motion;
    },

    tick(dt) {
      now += Math.max(0, dt);
      if (sleepAfter > 0 && !asleep && !appMood && now - lastActivity >= sleepAfter) asleep = true;
      if (reaction && now >= reaction.until) reaction = null;

      chooseAttention();
      // While wandering, pick a new glance every couple of seconds.
      if (attention === "wander" && !reduced && now - wanderAt >= 1500 + traits.chaos * 20) {
        wanderAt = now;
        wanderGaze = WANDER_GAZES[rng.int(WANDER_GAZES.length)]!;
      }

      if (now - gazeAt >= gazeDelay) {
        gazeAt = now;
        if (attention === "asleep") gaze = { x: 0, y: 0 };
        else if (attention === "focus" && focusTarget) gaze = snapGaze(focusTarget);
        else if (attention === "follow" && target) gaze = snapGaze(target);
        else if (attention === "wander" && !reduced) gaze = wanderGaze;
        else gaze = { x: 0, y: 0 };
      }

      mood = appMood ?? reaction?.mood ?? (asleep ? "sleepy" : "neutral");

      // Blinks come every two to four seconds, and one in four is a quick double blink.
      let blink = false;
      if (!reduced && mood !== "sleepy") {
        if (now >= nextBlink) {
          blinkUntil = now + 140;
          const double = rng.int(100);
          const gap = rng.int(1800);
          nextBlink = double < 25 ? now + 320 : now + blinkMin + gap;
        }
        blink = now < blinkUntil;
      }

      // Motion. Off for reduced motion; otherwise the shape's idle loop, unless the mood or a reaction says otherwise.
      let lift = 0, dx = 0, lean = 0, squash = 0, wave = 0, amp = 0;
      if (!reduced) {
        const step = Math.floor((now + phase) / stepMs);
        const i = step & 7;
        if (asleep || mood === "sleepy") {
          squash = BREATHE[Math.floor((now + phase) / (stepMs * 3)) & 7]!;
        } else if (reaction && (reaction.mood === "happy" || reaction.mood === "surprised") && now - reaction.start < 800) {
          const k = Math.floor((now - reaction.start) / 100);
          lift = JUMP.lift[k]!;
          squash = JUMP.squash[k]!;
        } else if (mood === "sad") {
          squash = 1; // droop
        } else {
          lift = style.lift[i]!;
          dx = style.dx[i]!;
          lean = style.lean[i]!;
          squash = style.squash[i]!;
          amp = style.amp;
          wave = style.wave === "step" ? step & 7 : style.wave === "half" ? Math.floor(step / 2) & 7 : 0;
          if (mood === "thinking") lean = clamp(lean + 1, -3, 3);
        }
      }

      return { mood, gaze, blink, lift, dx, lean, squash, wave, amp };
    },
  };
}
