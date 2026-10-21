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

## Grid and geometry (v1)
The grid is 32x32 (`SIZE`). The left half is columns 0..15 (`AXIS` = 15 is its last column) and is mirrored
onto 16..31. The body's last row is 25 (`GROUND`); bottom parts use rows 26..29; rows 0..3 are reserved
(`TOP` = 4 is the first row a part may use; the outline sits above it and the idle bob lifts the mascot `BOB` = 2 rows).
Body: `half = 8 + heft*5/100` columns, `bh = 17 - heft*5/100 - heightRoll` rows (heightRoll 0..2).
Faces use a 6x6 eye box per eye, mouths and props in `spec/faces/faces.json`; a gaze step moves a pupil 2 pixels.
Shade covers the bottom two rows of every downward-facing edge; the shine is three pixels; the outline is one pixel.

### Body shapes, tails and marks (v1)
`eff = clamp(roundness + int(15) - 7)`. `eff >= 50` picks from the soft list (blob, egg, pear, capsule, dome, cloud,
twin, box), otherwise the sharp list (star, gem, wedge, hex, kite), using `shapeRoll % list.length`.
Proportions come from `lean = clamp(heft + leanRoll)` with `leanRoll = int(61) - 30`:
`half = clamp(7 + lean*6/100 + widthRoll - 1 + grow, 7, 13)`, `bh = clamp(18 - lean*7/100 - heightRoll + stretchRoll - 2, 10, 18)`;
`grow` is 2 for star/gem/kite/hex, 1 for wedge, else 0. Each shape is a per-row half width (`rowWidths`); the cloud also
loses 3 rows under every other group of three columns. Parts include a `tail` slot drawn after mirroring on the
right side only. One marking per sprite: none, belly (light oval), spots, stripes (shade), cheeks and a forehead gem
(accent, drawn once the eyes are placed). Narrow bodies (half < 9) get the small "dot" eyes.
Draw order: traits(4), eff, shapeRoll, heightRoll, stretchRoll, widthRoll, leanRoll, chamferRoll, wedgeRoll,
parts (top, side, bottom, top2, tail: 5 each), markRoll + 6, mutations (2 each), eyeInnerRoll, eyeStyleRoll, entryRoll.
