# Pixie: Implementation Plan

[PLAN.md](PLAN.md) says *what* and *why*. This file says *how*, in the order we build it.
Tick a box only when the thing works and its tests pass. One logical change per commit.

## Decisions taken (the open questions in PLAN.md)

| Question | Decision | Revisit when |
|---|---|---|
| Species | One creature type. Text changes its body template, parts, face and colors. | Variety check (M4) shows too many look-alikes |
| Body deformation | Faces swap per mood. Body only does 1px bob / squash. No limb animation. | After v1 ships |
| Meaning-aware mode | Not in v1. Phonetics only. Core has no network and no lexicon. | v2 |
| Grid | 32x32 (changed from 16x16: it looked too pixelated) | A use case needs even finer art |
| License | MIT | Before publish |
| Package names | `pixie-mascot`, `pixie-mascot-react` (workspace names; registry availability unchecked) | Before publish |
| Palette presets | `gameboy`, `mono`, `amber` | Later |
| Algorithm version | `1`, marked **draft** until M4 is signed off, then frozen | n/a |

## Algorithm v1 (summary; full rules go in `spec/`)

```
normalize(text)   NFC, lowercase, trim, collapse whitespace, cap 128 code points
hash = FNV-1a 32 over UTF-8 bytes
rng  = mulberry32(hash)                    integer-only, one stream, fixed call order
traits (0..100 ints): roundness, heft, energy, chaos   from letter classes + small rng jitter
body  = template chosen by roundness (blob / box / wedge / gem), size from heft
parts = top / side / bottom from spec/parts, chosen by roundness + energy + rng
mirror left half -> right half, then chaos breaks symmetry with N mutations
outline + shade + highlight passes
face anchors (eye row, eye gap, mouth row) stored on the sprite
palette = curated pool, group picked by traits, entry by rng
Sprite { version, grid(32x32 palette idx), palette, traits, anchors, eyeStyle, seed }
```

Palette indices: 0 clear, 1 body, 2 outline, 3 shade, 4 light, 5 accent, 6 ink, 7 white.

Faces are composed on top at render time: `compose(sprite, {mood, gaze, blink, bob})`.
The golden file hashes the **base grid with the neutral face**.

## Milestones and tasks

### M1 Foundations
- [x] pnpm workspace builds and tests (TypeScript strict, vitest, tsup)
- [x] `normalize`, `utf8`, `fnv1a`, `mulberry32` with unit tests and known vectors
- [x] `spec/sprite.md`, `spec/VERSIONS.md`

### M2 First sprite
- [x] `spec/traits.md`, letter tables in `spec/letters.json`
- [x] `traits(text)` returns integers 0..100, no floats
- [x] Body templates, parts data (`spec/parts/*.json`), mirror, mutations, outline/shade
- [x] Palette pool (`spec/palettes.json`) and presets
- [x] `generate(text, {version, palette})`

### M3 Render + lab
- [x] `toSVG` (merged runs, crisp edges, aria-label via `describe`)
- [x] `apps/lab`: grid of N words, word list tab, mood tab, trait readout
- [x] Look at it in the browser. Round words round? Sharp words sharp? Tune. **Gate.**

### M4 Golden + variety
- [x] `spec/golden.json` (>= 500 inputs) + generator script + test
- [x] Property tests: repeatable, never throws, no NaN, grid always 32x32, indices in range
- [x] Variety script: 100k random strings, unique-sprite rate printed. Record in `spec/VERSIONS.md`
- [x] Mark v1 frozen after the owner reviews the art and accepts the variety numbers (frozen 2026-10-22)

### M5 Expressions + behavior
- [x] `spec/faces/*.json`: eyes x 2 styles x 6 moods + blink, mouths, props
- [x] `compose()` with gaze (8 dirs, snapped), blink, bob, mood
- [x] Behavior engine (pure, seeded, no DOM): idle, blink timer, reactions, attention state machine
      (follow / wander / focus / asleep), mood priority (app > reaction > idle)
- [x] Unit tests with a fake clock

### M6 React + auto
- [x] `packages/core` `./dom` entry: pointer tracking, delegated auto-reaction, `data-mascot` hints,
      `prefers-reduced-motion`
- [x] `<pixie-mascot>` web component
- [x] `pixie-mascot-react`: `<Mascot text mood size animated palette lookAt auto />`, SSR-safe
- [x] Component tests (jsdom)

### M7 Website (`apps/site`)
- [x] Playground (live text, traits, mood picker, per-platform snippets)
- [x] Gallery, docs page, reaction demo
- [x] Builds clean; looked at in a browser

### M8 Native ports (spec + golden only, never new logic)
- [x] Swift package: generator, behavior, `PixieView` + `PixieController` + `pixieTarget`; `swift test` (Swift Testing) against `spec/golden.json`. macOS verified; iOS SDK not available here
- [x] Kotlin: `:pixie` (JVM) and `:pixie-compose` (Compose Multiplatform, desktop JVM verified by off-screen render); Gradle tests against `spec/golden.json`. Android target not built (no Android SDK)

### M9 Ship readiness
- [x] GitHub Actions per package, path-filtered (written; **never run on a real runner**)
- [x] Root README with per-platform usage, versioning policy
- [x] Changesets config
- [x] Final run of every test suite; fill in CLAUDE.md "Commands" (see the end of this file)

## Definition of done (every milestone)

1. Tests for that milestone pass and are quoted from a real run.
2. `git status` clean; work committed in small commits.
3. PLAN.md / CLAUDE.md / this file still tell the truth.
4. Anything visual was opened and looked at, not assumed.

## Known risks while building

- Letter-sound mapping may look random. If the lab grid says so, stop and rework traits (M3 gate).
- Collisions: measured at 0.04% on 32x32 (was 0.5% on 16x16).
- Native ports may drift. The golden file is the only authority.

## Deviations from the plan, and what is still open

- v1 was frozen on 2026-10-22 after the owner signed off on the art.
- The golden file also holds SVG hashes and six scripted behavior traces; the lone-surrogate input became U+FFFD
  (Swift strings cannot hold one). The TS unit tests still cover lone surrogates.
- The behavior engine was ported to Swift and Kotlin too (not just the generator), because native mascots need
  the same life; it is proven by the behavior traces.
- Swift tests use Swift Testing, not XCTest (XCTest is missing from Command Line Tools).
- The Kotlin core is Kotlin/JVM, not Multiplatform. Compose is Compose Multiplatform with a desktop JVM target.
- Not verified: iOS compile, Android build, CI on real runners, publishing (names chosen: `pixie-mascot`, `pixie-mascot-react`; not published yet).
- Not built: meaning-aware mode, hosted SVG endpoint, extra moods (angry, love, ...), body squash/lean animation.

## Grid change: 16x16 -> 32x32 (2026-10-22, after review)

The owner found the 16x16 mascots too pixelated, so the grid became 32x32 (v1 is still a draft). Parts, faces,
eyes (6x6 boxes, gaze moves 2 pixels), mouths and props were redrawn in finer detail; the body formulas, shading
(two rows), shine (three pixels) and outline were adapted; the idle bob lifts 2 rows. All three languages were
updated and re-verified against a regenerated `spec/golden.json`. A hardcoded 16 left in the Compose view was
caught by its render test.

## Shape variety (2026-10-22, after review)

The owner pointed out most mascots looked alike (a wide flat blob). Using a sheet of Pokemon-style creatures as
inspiration for *silhouette archetypes* (not copying characters), the generator now has 13 body shapes with their own
proportions, a bigger parts library (rabbit/cat/bear ears, wings, flippers, flame, sprout), one-sided tails and 6
markings. TypeScript, Swift and Kotlin were all updated and pass the regenerated golden file.

## More types, motion and blinking (2026-10-22, after review)

The owner asked for more creature types (snakes, non-circle shapes), richer movement than a bounce, and more blinking.
22 body shapes now (mushroom, bell, drop, jellyfish, shield, hourglass, coiled snake, cobra, caterpillar added), with
text full of hissing letters (s z x h w y l) often making snakes. The pose gained lift, dx, lean, squash, wave and amp;
a motion style is chosen per shape (bounce, sway, waddle, slither, float, pulse) from `spec/motion.json`, reactions jump,
sad droops, sleep breathes. Blinks are roughly every 4 s (was 6) with occasional doubles. A bug where parts overhanging a
narrow body grew pillars downward was fixed by sliding parts inward. All three languages pass the regenerated golden file.

## Smooth rendering (2026-10-22, after review)

The owner still found 32x32 a bit blocky, so a smooth renderer was added on top of the same grid for a side-by-side
comparison (lab and site playground). Web only; not in the golden file; not ported to Swift/Kotlin. Verdict: the owner prefers the pixel look, so pixel stays the
default everywhere and smooth stays an optional web-only style (not ported).

## Final verification (2026-10-22)

TypeScript 73 tests, Swift 10 tests, Kotlin 10 tests; all three pass `spec/golden.json`.
Variety: 99.97% unique sprites over 100,000 distinct random strings (32x32 grid).
