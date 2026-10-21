import { describe, expect, it } from "vitest";
import { MAX_LIFT, MOODS, SIZE, TOP, compose, describe as describeSprite, generate, gridToString, toSVG } from "../src";
import { createRng } from "../src/rng";

const randomString = (rng: ReturnType<typeof createRng>): string => {
  const len = rng.int(40);
  let s = "";
  for (let i = 0; i < len; i++) {
    const kind = rng.int(4);
    if (kind === 0) s += String.fromCharCode(97 + rng.int(26));
    else if (kind === 1) s += String.fromCharCode(rng.int(0xffff)); // may be a lone surrogate
    else if (kind === 2) s += String.fromCodePoint(0x10000 + rng.int(0x1000));
    else s += " !?0123456789"[rng.int(13)];
  }
  return s;
};

describe("generate", () => {
  it("is repeatable", () => {
    const a = generate("bubbanbbebb");
    const b = generate("bubbanbbebb");
    expect(gridToString(a.grid)).toBe(gridToString(b.grid));
    expect(a.colors).toEqual(b.colors);
  });

  it("treats equivalent text as the same mascot", () => {
    expect(generate("  Bubba   Boo ").grid).toEqual(generate("bubba boo").grid);
  });

  it("produces a 32x32 grid with valid palette indices and empty top rows for lifting", () => {
    for (const text of ["", " ", "a", "bubba", "jsakkkwaakiyy", "\u{1F600}", "The quick brown fox"]) {
      const s = generate(text);
      expect(s.grid).toHaveLength(SIZE * SIZE);
      expect(s.body).toHaveLength(SIZE * SIZE);
      for (const v of s.grid) expect(v).toBeLessThanOrEqual(7);
      for (let i = 0; i < SIZE * (TOP - 1); i++) expect(s.body[i]).toBe(0);
      expect(s.colors).toHaveLength(8);
    }
  });

  it("never throws or yields NaN, whatever the input", () => {
    const rng = createRng(2024);
    for (let i = 0; i < 1500; i++) {
      const text = randomString(rng);
      const s = generate(text);
      for (const t of Object.values(s.traits)) {
        expect(Number.isInteger(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(100);
      }
      expect(toSVG(s.grid, s.colors)).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("maps soft sounds to round and sharp sounds to spiky", () => {
    const soft = generate("bubbanbbebb").traits;
    const sharp = generate("jsakkkwaakiyy").traits;
    expect(soft.roundness).toBeGreaterThan(80);
    expect(sharp.roundness).toBeLessThan(40);
    expect(sharp.energy).toBeGreaterThan(soft.energy);
  });

  it("keeps the trend over many strings", () => {
    const rng = createRng(7);
    const mean = (alphabet: string): number => {
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        let s = "";
        for (let j = 0; j < 6 + rng.int(6); j++) s += alphabet[rng.int(alphabet.length)];
        sum += generate(s).traits.roundness;
      }
      return sum / 200;
    };
    expect(mean("bmnolu")).toBeGreaterThan(75);
    expect(mean("kztxqj")).toBeLessThan(25);
  });

  it("rejects unknown versions", () => {
    expect(() => generate("x", { version: 99 })).toThrow(RangeError);
  });

  it("applies palette presets", () => {
    const s = generate("bubba", { palette: "gameboy" });
    expect(s.colors[1]).toBe("#8bac0f");
    expect(s.colorName).toBe("gameboy");
  });

  it("describes itself for screen readers", () => {
    expect(describeSprite(generate("bubbanbbebb"))).toMatch(/^A [\w-]+, \w+ \w+ pixel mascot$/);
  });
});

describe("compose", () => {
  const sprite = generate("bubbanbbebb");
  it("draws every mood, gaze and blink without leaving the grid", () => {
    for (const mood of MOODS) {
      for (const blink of [false, true]) {
        for (const gx of [-1, 0, 1] as const) {
          for (const gy of [-1, 0, 1] as const) {
            const g = compose(sprite, { mood, blink, gaze: { x: gx, y: gy }, lift: gx === 1 ? 2 : 0, squash: gy, lean: gx, dx: gy, wave: gx + 1, amp: gy === 1 ? 2 : 0 });
            expect(g).toHaveLength(SIZE * SIZE);
            for (const v of g) expect(v).toBeLessThanOrEqual(7);
          }
        }
      }
    }
  });
  it("does not change the sprite it is given", () => {
    const before = gridToString(sprite.body);
    compose(sprite, { mood: "happy", lift: 2, squash: 1 });
    expect(gridToString(sprite.body)).toBe(before);
  });
  it("neutral compose equals the stored grid", () => {
    expect(compose(sprite, {})).toEqual(sprite.grid);
  });
  it("blinking changes the picture", () => {
    expect(compose(sprite, { blink: true })).not.toEqual(compose(sprite, {}));
  });
  it("gaze moves the pupils", () => {
    expect(compose(sprite, { gaze: { x: 1, y: 0 } })).not.toEqual(compose(sprite, {}));
  });
  it("lift moves everything up by that many rows", () => {
    const flat = compose(sprite, {});
    for (const lift of [1, 2, MAX_LIFT]) {
      const lifted = compose(sprite, { lift });
      for (let y = lift; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) expect(lifted[(y - lift) * SIZE + x]).toBe(flat[y * SIZE + x]);
      }
    }
  });
  it("squash shortens the body, stretch lengthens it, and the feet stay put", () => {
    const height = (g: Uint8Array): number => {
      let top = SIZE, bot = -1;
      for (let i = 0; i < g.length; i++) if (g[i] !== 0) { top = Math.min(top, Math.floor(i / SIZE)); bot = Math.max(bot, Math.floor(i / SIZE)); }
      return bot - top + 1;
    };
    const bottom = (g: Uint8Array): number => {
      for (let y = SIZE - 1; y >= 0; y--) for (let x = 0; x < SIZE; x++) if (g[y * SIZE + x] !== 0) return y;
      return -1;
    };
    const flat = compose(sprite, { mood: "neutral" });
    const pressed = compose(sprite, { mood: "neutral", squash: 2 });
    const stretched = compose(sprite, { mood: "neutral", squash: -2 });
    expect(height(pressed)).toBe(height(flat) - 2);
    expect(height(stretched)).toBe(height(flat) + 2);
    expect(bottom(pressed)).toBe(bottom(flat));
    expect(bottom(stretched)).toBe(bottom(flat));
  });
  it("lean tilts the top more than the feet; wave ripples rows; dx shifts the whole picture", () => {
    const flat = compose(sprite, {});
    const rowLeft = (g: Uint8Array, y: number): number => {
      for (let x = 0; x < SIZE; x++) if (g[y * SIZE + x] !== 0) return x;
      return -1;
    };
    const leaned = compose(sprite, { lean: 3 });
    const topY = flat.findIndex((v) => v !== 0) / SIZE | 0;
    let botY = SIZE - 1;
    while (flat.slice(botY * SIZE, botY * SIZE + SIZE).every((v) => v === 0)) botY--;
    expect(rowLeft(leaned, topY) - rowLeft(flat, topY)).toBeGreaterThan(rowLeft(leaned, botY) - rowLeft(flat, botY));
    expect(rowLeft(compose(sprite, { dx: 2 }), botY)).toBe(rowLeft(flat, botY) + 2);
    expect(compose(sprite, { amp: 2, wave: 1 })).not.toEqual(compose(sprite, { amp: 2, wave: 5 }));
    expect(compose(sprite, { amp: 0, wave: 3 })).toEqual(flat);
  });
});

describe("variety", () => {
  const rng = createRng(31337);
  const samples = Array.from({ length: 1500 }, () => {
    let text = "";
    for (let j = 0, n = 4 + rng.int(9); j < n; j++) text += String.fromCharCode(97 + rng.int(26));
    return generate(text);
  });

  it("uses every body shape and every mark", () => {
    expect(new Set(samples.map((s) => s.template)).size).toBe(22);
    expect(new Set(samples.map((s) => s.mark)).size).toBe(6);
  });

  it("gives round-sounding text soft shapes and sharp-sounding text pointy ones", () => {
    const soft = new Set(["blob", "egg", "pear", "capsule", "dome", "cloud", "twin", "box", "mushroom", "bell", "drop", "jelly"]);
    for (const w of ["bubbanbbebb", "mumu", "moon", "noodle"]) expect(soft.has(generate(w).template), w).toBe(true);
    for (const w of ["zzkt", "kixtz", "quartz", "kick"]) expect(soft.has(generate(w).template), w).toBe(false);
  });

  it("varies proportions a lot: tall, wide and in between", () => {
    const boxes = new Set<string>();
    let tall = 0, wide = 0;
    for (const s of samples) {
      let x0 = SIZE, x1 = 0, y0 = SIZE, y1 = 0;
      for (let i = 0; i < SIZE * SIZE; i++) {
        if (s.body[i] === 0) continue;
        const x = i % SIZE, y = Math.floor(i / SIZE);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      boxes.add(`${x1 - x0}x${y1 - y0}`);
      if (y1 - y0 > x1 - x0) tall++;
      if (x1 - x0 > 1.6 * (y1 - y0)) wide++;
    }
    expect(boxes.size).toBeGreaterThan(60);
    expect(tall).toBeGreaterThan(100);
    expect(wide).toBeGreaterThan(100);
  });

  it("some mascots have a tail, so they are not mirror images", () => {
    let asymmetric = 0;
    for (const s of samples) {
      for (let y = 0; y < SIZE && asymmetric >= 0; y++) {
        let diff = false;
        for (let x = 0; x < SIZE / 2; x++) if ((s.body[y * SIZE + x] === 0) !== (s.body[y * SIZE + SIZE - 1 - x] === 0)) diff = true;
        if (diff) {
          asymmetric++;
          break;
        }
      }
    }
    expect(asymmetric).toBeGreaterThan(300);
  });

  it("makes snakes from hissing letters", () => {
    const snaky = new Set(["serpent", "cobra", "caterpillar"]);
    let hits = 0;
    for (const w of ["sssnake", "hiss", "sizzle", "wally", "slither", "hush", "whistle", "shy", "yellow", "hello world"]) {
      if (snaky.has(generate(w).template)) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(5);
    expect(generate("sssnake").traits.slink).toBeGreaterThanOrEqual(30);
    expect(generate("bubba").traits.slink).toBeLessThan(30);
  });

  it("almost never repeats a look", () => {
    const seen = new Set(samples.map((s) => gridToString(s.grid) + s.colors.join()));
    expect(seen.size).toBeGreaterThan(1495);
  });
});
