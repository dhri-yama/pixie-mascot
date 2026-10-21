# Algorithm versions

The algorithm version is separate from package semver. A shipped version never changes.

| Version | Status | Notes |
|---|---|---|
| 1 | **draft** | Implemented in TypeScript, Swift and Kotlin and identical across them. Waiting for the owner to review the art (lab and site) and sign off; only then mark it frozen. |

Rules once a version is frozen: hashing, normalization, trait rules, parts, palettes, rounding,
and rng call order must not change. Any such change is a new version with its own golden entries.

## v1 measurements (2026-10-22, `pnpm variety`)

100,000 distinct random strings of 4-12 letters: 99,471 unique sprites (99.47%), 529 distinct inputs
shared a sprite with another input. Counting silhouettes and faces only (ignoring color): 96,721 unique.
Accepted for 16x16. Revisit (24x24 or more parts) if a use case needs fewer collisions.

## Golden file

`spec/golden.json` holds 500 inputs with seed, traits, template, eye style, anchors, colors, grid
hashes (neutral, per mood, and one gaze+blink+bob pose). Every package must reproduce it exactly.
Regenerate with `pnpm golden:update` only while a version is a draft.
