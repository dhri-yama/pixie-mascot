# Sprite spec (v1)

Everything here is integer math. Ports must reproduce it exactly.

## Normalization
1. Unicode NFC.
2. Whitespace runs (U+0009-000D, U+0020, U+00A0, U+2000-200A, U+2028, U+2029, U+202F, U+205F, U+3000)
   become one U+0020. Leading and trailing whitespace is dropped.
3. ASCII `A-Z` become `a-z`. Nothing else is case-folded (avoids language differences).
4. Keep the first 128 code points; drop a trailing space if the cut leaves one.

## Hash
FNV-1a 32 bit over the UTF-8 bytes of the normalized text. Offset `0x811c9dc5`, prime `0x01000193`.
Lone surrogates encode as U+FFFD. Vectors: `""` = `0x811c9dc5`, `"a"` = `0xe40c292c`, `"foobar"` = `0xbf9cf968`.

## PRNG
mulberry32 returning uint32, seeded with the hash:
```
a = (a + 0x6D2B79F5) | 0
t = imul(a ^ (a >>> 15), 1 | a)
t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t
out = (t ^ (t >>> 14)) >>> 0
```
`int(n) = next() % n`. `chance(p) = next() % 100 < p`. Seed 1 gives `2693262067, 11749833, 2265367787`.
The order of rng calls in the generator is part of the algorithm.
