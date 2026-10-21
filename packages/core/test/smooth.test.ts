import { describe, expect, it } from "vitest";
import { MOODS, SIZE, compose, generate, toSVG, toSmoothSVG } from "../src";
import { createRng } from "../src/rng";

const WORDS = ["bubbanbbebb", "jsakkkwaakiyy", "mumu", "kick", "quartz", "sagar", "claude", "sleepy cloud", "", "123", "zzkt"];

describe("toSmoothSVG", () => {
  it("is deterministic and well formed", () => {
    const s = generate("bubbanbbebb");
    const a = toSmoothSVG(s.grid, s.colors, { size: 96, label: "x" });
    expect(a).toBe(toSmoothSVG(s.grid, s.colors, { size: 96, label: "x" }));
    expect(a.startsWith("<svg")).toBe(true);
    expect(a).toContain('width="96"');
    expect(a).toContain('aria-label="x"');
    expect(a).toContain("<path");
    expect(a).not.toContain("<rect");
    expect(a).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("keeps every coordinate inside the viewBox, for every mood", () => {
    for (const w of WORDS) {
      const s = generate(w);
      for (const mood of MOODS) {
        const svg = toSmoothSVG(compose(s, { mood, blink: mood === "happy", bob: mood === "sad" }), s.colors);
        for (const m of svg.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
          const x = Number(m[1]), y = Number(m[2]);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(SIZE);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(SIZE);
        }
      }
    }
  });

  it("with zero smoothing every vertex sits on a pixel corner", () => {
    const s = generate("jsakkkwaakiyy");
    const svg = toSmoothSVG(s.grid, s.colors, { smoothness: 0 });
    for (const m of svg.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
      expect(Number.isInteger(Number(m[1]))).toBe(true);
      expect(Number.isInteger(Number(m[2]))).toBe(true);
    }
  });

  it("draws floating props (the sleepy Z) as their own accent shape", () => {
    const s = generate("sagar");
    const plain = toSmoothSVG(compose(s, { mood: "neutral" }), s.colors);
    const sleepy = toSmoothSVG(compose(s, { mood: "sleepy" }), s.colors);
    const accent = (svg: string): number => svg.split(`fill="${s.colors[5]}"`).length - 1;
    expect(accent(sleepy)).toBeGreaterThan(accent(plain));
  });

  it("uses a stable clip id for identical grids and different ids for different ones", () => {
    const a = generate("mumu"), b = generate("kick");
    const id = (svg: string): string => /clipPath id="([^"]+)"/.exec(svg)![1]!;
    expect(id(toSmoothSVG(a.grid, a.colors))).toBe(id(toSmoothSVG(a.grid, a.colors)));
    expect(id(toSmoothSVG(a.grid, a.colors))).not.toBe(id(toSmoothSVG(b.grid, b.colors)));
  });

  it("never throws on random sprites and fuzzed grids", () => {
    const rng = createRng(99);
    for (let i = 0; i < 300; i++) {
      let text = "";
      for (let j = 0; j < rng.int(12); j++) text += String.fromCharCode(97 + rng.int(26));
      const s = generate(text);
      expect(toSmoothSVG(s.grid, s.colors).length).toBeGreaterThan(50);
    }
    const noise = new Uint8Array(SIZE * SIZE).map(() => rng.int(8));
    expect(() => toSmoothSVG(noise, ["", "#111", "#222", "#333", "#444", "#555", "#666", "#777"])).not.toThrow();
    expect(toSmoothSVG(new Uint8Array(SIZE * SIZE), [])).toContain("<svg");
  });

  it("describes the same picture as toSVG (same colors used)", () => {
    const s = generate("sagar");
    const smooth = toSmoothSVG(s.grid, s.colors);
    // body, outline and shade are always present; accent only when the sprite has accent pixels.
    for (const c of s.colors.slice(1, 4)) expect(smooth).toContain(c);
    expect(toSVG(s.grid, s.colors)).toContain("<rect");
  });
});
