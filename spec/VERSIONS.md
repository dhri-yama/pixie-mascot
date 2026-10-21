# Algorithm versions

The algorithm version is separate from package semver. A shipped version never changes.

| Version | Status | Notes |
|---|---|---|
| 1 | **draft** | Implemented in TypeScript, Swift and Kotlin and identical across them. Waiting for the owner to review the art (lab and site) and sign off; only then mark it frozen. |

Rules once a version is frozen: hashing, normalization, trait rules, parts, palettes, rounding,
and rng call order must not change. Any such change is a new version with its own golden entries.

## v1 measurements (2026-10-22, `pnpm variety`)

Grid is 32x32, with 13 body shapes, 6 markings and one-sided tails. 100,000 distinct random strings of 4-12 letters:
100,000 unique sprites (no collisions), 99,999 unique silhouettes-and-faces ignoring color.
History: the first draft used 16x16 (99.47% unique, 529 collisions) and looked too pixelated; the grid was doubled
and the art redrawn (99.97%, 35 collisions). Then most mascots still looked alike (a wide flat blob with ears), so
body archetypes, proportions, tails and markings were added.

## Golden file

`spec/golden.json` holds 500 inputs with seed, traits, template, eye style, anchors, colors, grid
hashes (neutral, per mood, and one gaze+blink+bob pose). Every package must reproduce it exactly.
Regenerate with `pnpm golden:update` only while a version is a draft.
