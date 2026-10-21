import { describe, expect, it } from "vitest";
import { normalize } from "../src/normalize";
import { fnv1a, hashText, utf8 } from "../src/hash";
import { createRng } from "../src/rng";

describe("normalize", () => {
  it("trims, collapses whitespace and lowercases ASCII", () => {
    expect(normalize("  Bubba \t\n Bubba  ")).toBe("bubba bubba");
  });
  it("treats composed and decomposed accents the same", () => {
    expect(normalize("café")).toBe(normalize("café"));
  });
  it("leaves non-ASCII case alone", () => {
    expect(normalize("É")).toBe("É");
  });
  it("caps at 128 code points without splitting emoji", () => {
    const out = normalize("\u{1F600}".repeat(200));
    expect(Array.from(out)).toHaveLength(128);
  });
  it("handles empty input", () => {
    expect(normalize("   ")).toBe("");
  });
});

describe("hash", () => {
  it("matches published FNV-1a vectors", () => {
    expect(fnv1a([])).toBe(0x811c9dc5);
    expect(fnv1a(utf8("a"))).toBe(0xe40c292c);
    expect(fnv1a(utf8("foobar"))).toBe(0xbf9cf968);
  });
  it("encodes UTF-8 like TextEncoder", () => {
    const s = "aé€\u{1F600}";
    expect(utf8(s)).toEqual(Array.from(new TextEncoder().encode(s)));
  });
  it("replaces lone surrogates", () => {
    expect(utf8("\ud800")).toEqual([0xef, 0xbf, 0xbd]);
  });
  it("is stable", () => {
    expect(hashText("bubbanbbebb")).toBe(hashText("bubbanbbebb"));
  });
});

describe("rng", () => {
  it("is deterministic and matches pinned vectors", () => {
    const r = createRng(1);
    expect([r.next(), r.next(), r.next()]).toEqual([2693262067, 11749833, 2265367787]);
  });
  it("int stays in range", () => {
    const r = createRng(12345);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });
});
