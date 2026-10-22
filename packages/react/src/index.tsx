import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
  type CSSProperties,
} from "react";
import { compose, describe, generate, toSVG, toSmoothSVG, type Mood, type Sprite } from "@pixie/core";
import { mountMascot, type MountedMascot, type MountOptions } from "@pixie/core/dom";

export type { Mood, Sprite, PresetName, AttentionMode } from "@pixie/core";
export type { MountOptions } from "@pixie/core/dom";

export interface MascotProps extends MountOptions {
  className?: string;
  style?: CSSProperties;
}

export interface MascotHandle {
  readonly sprite: Sprite | undefined;
  setMood(mood: Mood | null): void;
  react(mood: Mood, ms?: number): void;
  poke(): void;
  focus(target: Element | null): void;
  lookAtPoint(point: { x: number; y: number } | null): void;
}

/** The static markup used for server rendering and the first paint, before animation starts. */
function firstPaint(p: MascotProps): string {
  const sprite = generate(p.text, { palette: p.palette });
  const pose = { mood: p.mood ?? ("neutral" as const) };
  const opts = { size: p.size ?? 64, label: p.label ?? describe(sprite) };
  return p.smooth ? toSmoothSVG(compose(sprite, pose), sprite.colors, opts) : toSVG(compose(sprite, pose), sprite.colors, opts);
}

/**
 * A pixel mascot made from `text`. Same text, same mascot.
 *
 *   <Mascot text={user.name} size={48} />
 *   <Mascot text="helper" mood={loading ? "thinking" : "happy"} auto />
 */
export const Mascot = forwardRef<MascotHandle, MascotProps>(function Mascot(props, ref) {
  const { className, style, ...options } = props;
  const host = useRef<HTMLSpanElement>(null);
  const mounted = useRef<MountedMascot | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // Fixed after the first render so React never overwrites what the animation draws.
  const [html] = useState(() => firstPaint(options));

  useEffect(() => {
    const m = mountMascot(host.current!, optionsRef.current);
    mounted.current = m;
    return () => {
      m.destroy();
      mounted.current = null;
    };
  }, []);

  const { text, size, palette, mood, attention, animated, auto, fps, label, reducedMotion, sleepAfterMs, smooth, walk } = options;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mounted.current?.update({ text, size, palette, mood: mood ?? null, attention, animated, auto, fps, label, reducedMotion, sleepAfterMs, smooth, walk });
  }, [text, size, palette, mood, attention, animated, auto, fps, label, reducedMotion, sleepAfterMs, smooth, walk]);

  useImperativeHandle(ref, () => ({
    get sprite() {
      return mounted.current?.sprite;
    },
    setMood: (m) => mounted.current?.setMood(m),
    react: (m, ms) => mounted.current?.react(m, ms),
    poke: () => mounted.current?.poke(),
    focus: (el) => mounted.current?.focus(el),
    lookAtPoint: (p) => mounted.current?.lookAtPoint(p),
  }), []);

  return (
    <span
      ref={host}
      className={className}
      style={{ display: "inline-block", lineHeight: 0, ...style }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
