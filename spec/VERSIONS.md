# Algorithm versions

The algorithm version is separate from package semver. A shipped version never changes.

| Version | Status | Notes |
|---|---|---|
| 1 | **draft** | Implemented in TypeScript, Swift and Kotlin and identical across them. Waiting for the owner to review the art (lab and site) and sign off; only then mark it frozen. |

Rules once a version is frozen: hashing, normalization, trait rules, parts, palettes, rounding,
and rng call order must not change. Any such change is a new version with its own golden entries.

## v1 measurements (2026-10-22, `pnpm variety`)

Grid 32x32, 22 body shapes (including a coiled snake, cobra and caterpillar), 6 markings, one-sided tails, a motion
style per shape. 100,000 distinct random strings of 4-12 letters: 99,954 unique sprites (99.95%, 46 shared a sprite),
99,601 unique silhouettes-and-faces ignoring color.
History: 16x16 first draft (99.47%); 32x32 (99.97%); 13 shapes and markings (100.00%); 22 shapes (99.95%: the snake
and cobra shapes have fewer degrees of freedom).

## Golden file

`spec/golden.json` holds 500 inputs with seed, traits, template, eye style, anchors, colors, grid
hashes (neutral, per mood, and one gaze+blink+bob pose). Every package must reproduce it exactly.
Regenerate with `pnpm golden:update` only while a version is a draft.
