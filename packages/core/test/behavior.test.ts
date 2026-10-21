import { describe, expect, it } from "vitest";
import { createBehavior, snapGaze, type Behavior, type BehaviorOptions } from "../src";

const traits = { roundness: 50, heft: 50, energy: 50, chaos: 50 };
const make = (o: Partial<BehaviorOptions> = {}): Behavior => createBehavior({ seed: 1234, traits, ...o });

/** Run for `ms` in 100ms steps, returning every pose. */
function run(b: Behavior, ms: number, step = 100) {
  const poses = [];
  for (let t = 0; t < ms; t += step) poses.push(b.tick(step));
  return poses;
}

describe("snapGaze", () => {
  it("snaps to 8 directions with a deadzone", () => {
    expect(snapGaze({ x: 0.1, y: -0.2 })).toEqual({ x: 0, y: 0 });
    expect(snapGaze({ x: 0.9, y: 0.9 })).toEqual({ x: 1, y: 1 });
    expect(snapGaze({ x: -5, y: 0.31 })).toEqual({ x: -1, y: 1 });
  });
});

describe("behavior", () => {
  it("is deterministic for the same seed and calls", () => {
    const a = make(), b = make();
    a.lookAt({ x: 1, y: 0 });
    b.lookAt({ x: 1, y: 0 });
    expect(run(a, 20000)).toEqual(run(b, 20000));
  });

  it("differs between seeds", () => {
    expect(run(make({ seed: 1 }), 20000)).not.toEqual(run(make({ seed: 2 }), 20000));
  });

  it("blinks every few seconds", () => {
    const poses = run(make(), 20000, 50);
    const blinks = poses.filter((p) => p.blink).length;
    expect(blinks).toBeGreaterThan(0);
    expect(blinks).toBeLessThan(poses.length / 10);
  });

  it("bobs while idle", () => {
    const poses = run(make(), 5000);
    expect(poses.some((p) => p.bob)).toBe(true);
    expect(poses.some((p) => !p.bob)).toBe(true);
  });

  it("follows the cursor and snaps its gaze", () => {
    const b = make({ attention: "always" });
    b.lookAt({ x: 1, y: -1 });
    const poses = run(b, 1000);
    expect(poses[poses.length - 1]!.gaze).toEqual({ x: 1, y: -1 });
    expect(b.attention).toBe("follow");
  });

  it("'always' never wanders away from the cursor", () => {
    const b = make({ attention: "always", sleepAfterMs: 0 });
    b.lookAt({ x: -1, y: 0 });
    // Skip the first half second: the mascot reacts to the cursor after a short delay.
    for (const p of run(b, 60000).slice(5)) expect(p.gaze).toEqual({ x: -1, y: 0 });
  });

  it("'never' ignores the cursor", () => {
    const b = make({ attention: "never" });
    b.lookAt({ x: 1, y: 1 });
    run(b, 2000);
    expect(b.attention).toBe("wander");
  });

  it("'sometimes' looks away now and then, but follows most of the time", () => {
    const b = make();
    b.lookAt({ x: 1, y: 0 });
    let follow = 0, wander = 0;
    for (let t = 0; t < 120000; t += 100) {
      b.tick(100);
      b.lookAt({ x: 1, y: (t / 100) % 2 ? 0.01 : 0 }); // keep the cursor "alive"
      if (b.attention === "follow") follow++;
      if (b.attention === "wander") wander++;
    }
    expect(wander).toBeGreaterThan(0);
    expect(follow).toBeGreaterThan(wander);
  });

  it("focus beats the cursor", () => {
    const b = make({ attention: "always" });
    b.lookAt({ x: 1, y: 0 });
    b.focus({ x: -1, y: 1 });
    const poses = run(b, 1000);
    expect(poses[poses.length - 1]!.gaze).toEqual({ x: -1, y: 1 });
    expect(b.attention).toBe("focus");
    b.focus(null);
    run(b, 1000);
    expect(b.attention).toBe("follow");
  });

  it("app mood beats a reaction, which beats idle", () => {
    const b = make();
    expect(b.tick(100).mood).toBe("neutral");
    b.react("happy", 1000);
    expect(b.tick(100).mood).toBe("happy");
    b.setMood("sad");
    expect(b.tick(100).mood).toBe("sad");
    b.setMood(null);
    expect(b.tick(100).mood).toBe("happy"); // reaction still running
    run(b, 1500);
    expect(b.mood).toBe("neutral");
  });

  it("falls asleep when idle and wakes when poked", () => {
    const b = make({ sleepAfterMs: 5000 });
    run(b, 6000);
    expect(b.mood).toBe("sleepy");
    expect(b.attention).toBe("asleep");
    expect(run(b, 1000).every((p) => !p.blink)).toBe(true);
    b.poke();
    expect(b.tick(100).mood).toBe("surprised");
    run(b, 1500);
    expect(b.mood).toBe("neutral");
  });

  it("cursor movement keeps it awake; app mood prevents sleep", () => {
    const b = make({ sleepAfterMs: 5000 });
    for (let t = 0; t < 20000; t += 100) {
      b.lookAt({ x: (t / 100) % 7, y: 0 });
      b.tick(100);
    }
    expect(b.mood).not.toBe("sleepy");
    const c = make({ sleepAfterMs: 5000 });
    c.setMood("thinking");
    run(c, 20000);
    expect(c.mood).toBe("thinking");
  });

  it("sleepAfterMs 0 never sleeps", () => {
    const b = make({ sleepAfterMs: 0 });
    run(b, 600000, 1000);
    expect(b.mood).toBe("neutral");
  });

  it("reduced motion: no bob, no blink, no wandering, gaze still follows", () => {
    const b = make({ reducedMotion: true, sleepAfterMs: 0 });
    b.lookAt({ x: 1, y: 0 });
    const poses = run(b, 30000);
    expect(poses.some((p) => p.bob || p.blink)).toBe(false);
    expect(poses[poses.length - 1]!.gaze).toEqual({ x: 1, y: 0 });
  });

  it("calm mascots react slower than energetic ones", () => {
    const delayFor = (energy: number): number => {
      const b = make({ attention: "always", traits: { ...traits, energy } });
      b.tick(1000);
      b.lookAt({ x: 1, y: 0 });
      for (let t = 0; t < 1000; t += 10) if (b.tick(10).gaze.x === 1) return t;
      return Infinity;
    };
    expect(delayFor(0)).toBeGreaterThan(delayFor(100));
  });
});
