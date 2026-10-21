// Spec: spec/traits.md. Text sound -> four integer traits (0..100). Integer math only.

import letters from "../../../spec/letters.json";
import type { Rng } from "./rng";

export interface Traits {
  roundness: number;
  heft: number;
  energy: number;
  chaos: number;
  /** Share (0..100) of hissing, slithering letters (s z x h w y l). High values can make a snake. */
  slink: number;
}

export const clamp = (v: number, lo = 0, hi = 100): number => (v < lo ? lo : v > hi ? hi : v);
/** Integer division truncating toward zero, same as Swift/Kotlin `/` on integers. */
export const idiv = (a: number, b: number): number => Math.trunc(a / b);

type LetterRow = readonly [number, number, number, number, number];
const TABLE = letters as unknown as Record<string, LetterRow>;
const VOWELS = "aeiou";
const SLINKY = "szxhwyl";

/**
 * Consumes exactly 4 rng draws (one jitter per trait), regardless of input.
 */
export function computeTraits(norm: string, rng: Rng): Traits {
  const d = [rng.next(), rng.next(), rng.next(), rng.next()] as const;
  const small = d.map((v) => (v % 13) - 6);
  const big = d.map((v) => (v % 61) - 30);

  let round = 0, sharp = 0, heavy = 0, light = 0, rare = 0;
  let n = 0, cc = 0, mask = 0, slinky = 0;
  let prevConsonant = false;
  for (const ch of norm) {
    const code = ch.codePointAt(0)!;
    if (code < 97 || code > 122) {
      prevConsonant = false;
      continue;
    }
    const row = TABLE[ch] as LetterRow;
    round += row[0]; sharp += row[1]; heavy += row[2]; light += row[3]; rare += row[4];
    n++;
    if (SLINKY.includes(ch)) slinky++;
    mask |= 1 << (code - 97);
    const consonant = !VOWELS.includes(ch);
    if (consonant && prevConsonant) cc++;
    prevConsonant = consonant;
  }

  if (n === 0) {
    return {
      roundness: clamp(50 + big[0]!),
      heft: clamp(50 + big[1]!),
      energy: clamp(50 + big[2]!),
      chaos: clamp(50 + big[3]!),
      slink: 0,
    };
  }

  let distinct = 0;
  for (let m = mask; m !== 0; m &= m - 1) distinct++;

  const jr = n < 3 ? big[0]! : small[0]!;
  const jh = n < 3 ? big[1]! : small[1]!;
  const je = n < 3 ? big[2]! : small[2]!;
  const jc = n < 3 ? big[3]! : small[3]!;

  const roundRaw = 50 + idiv(idiv((round - sharp) * 100, round + sharp + 1) * 55, 100);
  const roundness = clamp(roundRaw + jr);

  const heftRatio = idiv((heavy - light) * 100, heavy + light + 1);
  const heft = clamp(50 + idiv(heftRatio * 45, 100) + clamp(n - 6, -6, 10) * 2 + jh);

  const rareD = idiv(rare * 100, n);
  const clusterD = idiv(cc * 100, n);
  const energy = clamp(25 + rareD * 2 + idiv(clusterD, 2) + idiv(50 - roundRaw, 2) + je);

  const variety = idiv(distinct * 100, n + 2);
  const chaos = clamp(variety + idiv(rareD, 2) + idiv(energy - 50, 4) + jc);

  return { roundness, heft, energy, chaos, slink: idiv(slinky * 100, n) };
}
