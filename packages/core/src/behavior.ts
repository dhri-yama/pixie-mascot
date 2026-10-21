// Spec: spec/behavior.md. Pure, seeded state machine: no DOM, no clock, no Math.random().
// The host calls tick(dtMs) and draws the returned Pose with compose(). Same seed + same calls = same poses.

import { createRng, type Rng } from "./rng";
import { clamp } from "./traits";
import type { Traits } from "./traits";
import type { Gaze, Mood, Pose } from "./types";

export type Attention = "follow" | "wander" | "focus" | "asleep";
export type AttentionMode = "always" | "sometimes" | "never";

/** A direction from the mascot to something. Length ~1 means "far away". */
export interface Vec {
  x: number;
  y: number;
}

export interface BehaviorOptions {
  /** Use the sprite's seed so each mascot has its own rhythm. */
  seed: number;
  traits: Traits;
  /** always = never looks away from the cursor, never = ignores it, sometimes = mixes both. */
  attention?: AttentionMode;
  /** No bobbing, no wandering, no blinking. Gaze still follows. */
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
}

/** Turn a direction into one of 8 gaze directions (or center). Deadzone keeps small offsets still. */
export function snapGaze(v: Vec, deadzone = 0.3): Gaze {
  const f = (n: number): -1 | 0 | 1 => (n > deadzone ? 1 : n < -deadzone ? -1 : 0);
  return { x: f(v.x), y: f(v.y) };
}

const WANDER_GAZES: Gaze[] = [
  { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
  { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 0 },
];

export function createBehavior(options: BehaviorOptions): Behavior {
  const { traits } = options;
  const rng: Rng = createRng((options.seed ^ 0x9e3779b9) | 0);
  const reduced = options.reducedMotion ?? false;
  const sleepAfter = options.sleepAfterMs ?? 30000;
  let mode: AttentionMode = options.attention ?? "sometimes";

  // Personality from traits (integers, milliseconds).
  const blinkMin = 6000 - traits.energy * 30; // energetic: blinks more often
  const bobHalf = clamp(700 - traits.energy * 4, 250, 700); // energetic: bobs faster
  const gazeDelay = 80 + (100 - traits.energy) * 2; // calm: slower to react
  const span = 3000 + (100 - traits.chaos) * 40; // orderly: stays on the cursor longer
  const phase = rng.int(bobHalf * 2);

  let now = 0;
  let lastActivity = 0;
  let asleep = false;
  let appMood: Mood | null = null;
  let reaction: { mood: Mood; until: number } | null = null;
  let target: Vec | null = null;
  let focusTarget: Vec | null = null;
  let attention: Attention = "follow";
  let attentionUntil = now + span + rng.int(3000);
  let wanderGaze: Gaze = { x: 0, y: 0 };
  let wanderAt = 0;
  let gaze: Gaze = { x: 0, y: 0 };
  let gazeAt = 0;
  let nextBlink = blinkMin + rng.int(2500);
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
      reaction = { mood: m, until: now + ms };
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
      reaction = { mood: "surprised", until: now + 700 };
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

      let blink = false;
      if (!reduced && mood !== "sleepy") {
        if (now >= nextBlink) {
          blinkUntil = now + 140;
          nextBlink = now + blinkMin + rng.int(2500);
        }
        blink = now < blinkUntil;
      }

      const half = asleep ? bobHalf * 3 : bobHalf;
      const bob = !reduced && Math.floor((now + phase) / half) % 2 === 1;

      return { mood, gaze, blink, bob };
    },
  };
}
