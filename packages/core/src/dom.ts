// Browser glue: draws a mascot into an element, tracks the pointer, and (optionally) reacts to the
// page around it. Importing this file touches no globals; everything happens inside the functions.

import { createBehavior, type AttentionMode, type Behavior, type Vec } from "./behavior";
import { compose } from "./compose";
import { describe, generate } from "./generate";
import { toSVG, toSmoothSVG } from "./render";
import type { Mood, Pose, PresetName, Sprite } from "./types";
import { MOODS } from "./types";

export interface MountOptions {
  text: string;
  /** CSS pixels. Default 64. */
  size?: number;
  palette?: PresetName;
  /** Mood set by your app. null lets the mascot decide. */
  mood?: Mood | null;
  attention?: AttentionMode;
  /** false draws one still frame and never touches the pointer. Default true. */
  animated?: boolean;
  /** React to hover, click, focus, typing and form events anywhere on the page. Default false. */
  auto?: boolean;
  /** Draw rounded vector shapes instead of square pixels. Same sprite, softer look. Default false. */
  smooth?: boolean;
  /** Frames per second. Default 10. */
  fps?: number;
  /** Accessible name. Default is generated from the sprite. "" makes it decorative. */
  label?: string;
  /** Default follows the user's prefers-reduced-motion setting. */
  reducedMotion?: boolean;
  /** Idle time before sleeping. 0 never sleeps. Default 30000. */
  sleepAfterMs?: number;
}

export interface MountedMascot {
  readonly sprite: Sprite;
  /** The pose currently on screen. */
  readonly pose: Pose;
  update(options: Partial<MountOptions>): void;
  setMood(mood: Mood | null): void;
  react(mood: Mood, ms?: number): void;
  poke(): void;
  /** Look at a point in viewport (client) coordinates, or null to stop. */
  lookAtPoint(point: { x: number; y: number } | null): void;
  /** Look at an element and stay on it until focus(null). */
  focus(target: Element | null): void;
  destroy(): void;
}

/** Friendly names for moods the sprite sheet does not have yet. */
const MOOD_ALIAS: Record<string, Mood> = {
  worried: "sad", angry: "sad", excited: "happy", love: "happy", smug: "happy", confused: "thinking", shy: "sleepy",
};
export function toMood(name: string | null | undefined): Mood | null {
  if (!name) return null;
  if ((MOODS as readonly string[]).includes(name)) return name as Mood;
  return MOOD_ALIAS[name] ?? null;
}

const FAR = 200; // pixels that count as "far away" for gaze vectors
const INTERACTIVE = 'a[href], button, [role="button"], input, textarea, select, summary, [data-mascot]';
const TEXTY = 'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), textarea';

export function mountMascot(container: HTMLElement, options: MountOptions): MountedMascot {
  let opts: MountOptions = { size: 64, animated: true, auto: false, attention: "sometimes", fps: 10, ...options };
  const doc = container.ownerDocument;
  const win = doc.defaultView as Window;
  let sprite: Sprite;
  let behavior: Behavior;
  let appMood: Mood | null = opts.mood ?? null;
  let lastKey = "";
  let lastPose: Pose = {};
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastTime = 0;
  let detachers: Array<() => void> = [];

  const reduced = (): boolean => opts.reducedMotion ?? win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const center = (): { x: number; y: number } => {
    const r = container.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const vecTo = (x: number, y: number): Vec => {
    const c = center();
    return { x: (x - c.x) / FAR, y: (y - c.y) / FAR };
  };
  const vecToEl = (el: Element): Vec => {
    const r = el.getBoundingClientRect();
    return vecTo(r.left + r.width / 2, r.top + r.height / 2);
  };

  function draw(pose: Pose, force = false): void {
    const key = `${pose.mood}|${pose.gaze?.x}|${pose.gaze?.y}|${pose.blink}|${pose.bob}|${opts.smooth}`;
    if (key === lastKey && !force) return;
    lastKey = key;
    lastPose = pose;
    const label = opts.label ?? describe(sprite);
    const grid = compose(sprite, pose);
    container.innerHTML = opts.smooth
      ? toSmoothSVG(grid, sprite.colors, { size: opts.size, label })
      : toSVG(grid, sprite.colors, { size: opts.size, label });
  }

  function build(): void {
    sprite = generate(opts.text, { palette: opts.palette });
    behavior = createBehavior({
      seed: sprite.seed,
      traits: sprite.traits,
      attention: opts.attention,
      reducedMotion: reduced(),
      sleepAfterMs: opts.sleepAfterMs,
    });
    behavior.setMood(appMood);
  }

  function stop(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    for (const d of detachers) d();
    detachers = [];
  }

  function listen<K extends keyof DocumentEventMap>(type: K, fn: (e: DocumentEventMap[K]) => void, capture = false): void {
    doc.addEventListener(type, fn, { capture, passive: true });
    detachers.push(() => doc.removeEventListener(type, fn, { capture }));
  }

  function start(): void {
    stop();
    if (opts.animated === false) {
      draw({ mood: appMood ?? "neutral" }, true);
      return;
    }
    // Pointer and touch.
    if (opts.attention !== "never") {
      listen("pointermove", (e) => behavior.lookAt(vecTo(e.clientX, e.clientY)));
      listen("pointerdown", (e) => behavior.lookAt(vecTo(e.clientX, e.clientY)));
      const leave = (): void => behavior.lookAt(null);
      doc.documentElement.addEventListener("pointerleave", leave);
      detachers.push(() => doc.documentElement.removeEventListener("pointerleave", leave));
    }
    if (opts.auto) attachAuto();

    lastTime = Date.now();
    timer = setInterval(() => {
      if (doc.hidden) return;
      const t = Date.now();
      const pose = behavior.tick(t - lastTime);
      lastTime = t;
      draw(pose);
    }, Math.round(1000 / (opts.fps ?? 10)));
    draw(behavior.tick(0), true);
  }

  function attachAuto(): void {
    const ignored = (el: Element | null): boolean => !el || container.contains(el) || !!el.closest("[data-mascot-ignore]");
    let hoverEl: Element | null = null;
    let hoverMood = false;
    let passwordFocus = false;

    listen("pointerover", (e) => {
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE) ?? null;
      if (ignored(el) || el === hoverEl) return;
      hoverEl = el;
      behavior.focus(vecToEl(el!));
      const hint = toMood(el!.getAttribute("data-mascot"));
      if (hint) {
        behavior.react(hint, 600000);
        hoverMood = true;
      }
    });
    listen("pointerout", (e) => {
      if (!hoverEl || hoverEl.contains(e.relatedTarget as Node | null)) return;
      hoverEl = null;
      behavior.focus(null);
      if (hoverMood) behavior.clearReaction();
      hoverMood = false;
    });
    listen("click", (e) => {
      const el = (e.target as Element | null)?.closest?.('a[href], button, [role="button"], [data-mascot]') ?? null;
      if (ignored(el)) return;
      const hint = toMood(el!.getAttribute("data-mascot"));
      const submit = el!.matches('button:not([type]), [type="submit"]');
      behavior.react(hint ?? (submit ? "happy" : "surprised"), 900);
      hoverMood = false;
    });
    listen("focusin", (e) => {
      const el = e.target as Element | null;
      if (ignored(el) || !el!.matches(`${TEXTY}, select`)) return;
      behavior.focus(vecToEl(el!));
      if (el!.matches('input[type="password"]')) {
        passwordFocus = true;
        behavior.react("sleepy", 600000); // eyes shut while you type a secret
      }
    });
    listen("focusout", (e) => {
      const el = e.target as Element | null;
      if (ignored(el) || !el!.matches(`${TEXTY}, select`)) return;
      behavior.focus(null);
      if (passwordFocus) behavior.clearReaction();
      passwordFocus = false;
      if (el!.getAttribute("aria-invalid") === "true") behavior.react("sad", 1500);
    });
    listen("input", (e) => {
      const el = e.target as HTMLInputElement | null;
      if (ignored(el) || !el!.matches(TEXTY)) return;
      const r = el!.getBoundingClientRect();
      const caret = r.left + Math.min(r.width - 8, 10 + (el!.value?.length ?? 0) * 8);
      behavior.focus(vecTo(caret, r.top + r.height / 2));
    });
    listen("invalid", () => behavior.react("sad", 1600), true);
    listen("submit", () => behavior.react("happy", 1600));
  }

  const motion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  const onMotion = (): void => {
    if (opts.reducedMotion === undefined) {
      build();
      start();
    }
  };
  motion?.addEventListener?.("change", onMotion);

  build();
  start();

  return {
    get sprite() {
      return sprite;
    },
    get pose() {
      return lastPose;
    },
    update(next) {
      const rebuild = next.text !== undefined || next.palette !== undefined;
      const restart = next.animated !== undefined || next.auto !== undefined || next.attention !== undefined || next.fps !== undefined;
      opts = { ...opts, ...next };
      if (next.mood !== undefined) appMood = next.mood;
      if (rebuild || next.reducedMotion !== undefined || next.sleepAfterMs !== undefined) {
        build();
        start();
      } else if (restart) {
        behavior.setAttention(opts.attention ?? "sometimes");
        behavior.setMood(appMood);
        start();
      } else {
        if (next.mood !== undefined) behavior.setMood(appMood);
        draw(opts.animated === false ? { mood: appMood ?? "neutral" } : lastPose, true);
      }
    },
    setMood(mood) {
      appMood = mood;
      behavior.setMood(mood);
      if (opts.animated === false) draw({ mood: mood ?? "neutral" }, true);
    },
    react: (mood, ms) => behavior.react(mood, ms),
    poke: () => behavior.poke(),
    lookAtPoint: (p) => behavior.lookAt(p ? vecTo(p.x, p.y) : null),
    focus: (el) => behavior.focus(el ? vecToEl(el) : null),
    destroy() {
      stop();
      motion?.removeEventListener?.("change", onMotion);
      container.innerHTML = "";
    },
  };
}

/** Registers <pixie-mascot text="..."> (and returns the class). Safe to call more than once. */
export function definePixieElement(tag = "pixie-mascot"): CustomElementConstructor {
  const existing = customElements.get(tag);
  if (existing) return existing;

  class PixieElement extends HTMLElement {
    static observedAttributes = ["text", "size", "palette", "mood", "attention", "animated", "auto", "label", "smooth"];
    private mascot?: MountedMascot;

    private read(): MountOptions {
      const g = (n: string): string | null => this.getAttribute(n);
      const size = Number(g("size"));
      return {
        text: g("text") ?? this.textContent?.trim() ?? "",
        size: size > 0 ? size : 64,
        palette: (g("palette") as PresetName | null) ?? undefined,
        mood: toMood(g("mood")),
        attention: (g("attention") as AttentionMode | null) ?? "sometimes",
        animated: g("animated") !== "false",
        auto: this.hasAttribute("auto") && g("auto") !== "false",
        smooth: this.hasAttribute("smooth") && g("smooth") !== "false",
        label: g("label") ?? undefined,
      };
    }

    connectedCallback(): void {
      this.style.display = "inline-block";
      this.style.lineHeight = "0";
      this.mascot = mountMascot(this, this.read());
    }
    disconnectedCallback(): void {
      this.mascot?.destroy();
      this.mascot = undefined;
    }
    attributeChangedCallback(): void {
      this.mascot?.update(this.read());
    }
    get sprite(): Sprite | undefined {
      return this.mascot?.sprite;
    }
    setMood(mood: Mood | null): void {
      this.mascot?.setMood(mood);
    }
    react(mood: Mood, ms?: number): void {
      this.mascot?.react(mood, ms);
    }
    poke(): void {
      this.mascot?.poke();
    }
  }
  customElements.define(tag, PixieElement);
  return PixieElement;
}
