# Pixie: Implementation Plan

[PLAN.md](PLAN.md) says *what* and *why*. This file says *how*, in the order we build it.
Tick a box only when the thing works and its tests pass. One logical change per commit.

## Decisions taken (the open questions in PLAN.md)

| Question | Decision | Revisit when |
|---|---|---|
| Species | One creature type. Text changes its body template, parts, face and colors. | Variety check (M4) shows too many look-alikes |
| Body deformation | Faces swap per mood. Body only does 1px bob / squash. No limb animation. | After v1 ships |
| Meaning-aware mode | Not in v1. Phonetics only. Core has no network and no lexicon. | v2 |
| Grid | 16x16 | Collision rate too high |
| License | MIT | Before publish |
| Package names | `@pixie/core`, `@pixie/react` (workspace names; registry availability unchecked) | Before publish |
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
Sprite { version, grid(16x16 palette idx), palette, traits, anchors, eyeStyle, seed }
```

Palette indices: 0 clear, 1 body, 2 outline, 3 shade, 4 light, 5 accent, 6 ink, 7 white.

Faces are composed on top at render time: `compose(sprite, {mood, gaze, blink, bob})`.
The golden file hashes the **base grid with the neutral face**.

## Milestones and tasks

### M1 Foundations
- [ ] pnpm workspace builds and tests (TypeScript strict, vitest, tsup)
- [ ] `normalize`, `utf8`, `fnv1a`, `mulberry32` with unit tests and known vectors
- [ ] `spec/sprite.md`, `spec/VERSIONS.md`

### M2 First sprite
- [ ] `spec/traits.md`, letter tables in `spec/letters.json`
- [ ] `traits(text)` returns integers 0..100, no floats
- [ ] Body templates, parts data (`spec/parts/*.json`), mirror, mutations, outline/shade
- [ ] Palette pool (`spec/palettes.json`) and presets
- [ ] `generate(text, {version, palette})`

### M3 Render + lab
- [ ] `toSVG` (merged runs, crisp edges, aria-label via `describe`)
- [ ] `apps/lab`: grid of N words, word list tab, mood tab, trait readout
- [ ] Look at it in the browser. Round words round? Sharp words sharp? Tune. **Gate.**

### M4 Golden + variety
- [ ] `spec/golden.json` (>= 500 inputs) + generator script + test
- [ ] Property tests: repeatable, never throws, no NaN, grid always 16x16, indices in range
- [ ] Variety script: 100k random strings, unique-sprite rate printed. Record in `spec/VERSIONS.md`
- [ ] Mark v1 frozen only after the gate in M3 and the variety numbers are accepted

### M5 Expressions + behavior
- [ ] `spec/faces/*.json`: eyes x 2 styles x 6 moods + blink, mouths, props
- [ ] `compose()` with gaze (8 dirs, snapped), blink, bob, mood
- [ ] Behavior engine (pure, seeded, no DOM): idle, blink timer, reactions, attention state machine
      (follow / wander / focus / asleep), mood priority (app > reaction > idle)
- [ ] Unit tests with a fake clock

### M6 React + auto
- [ ] `packages/core` `./dom` entry: pointer tracking, delegated auto-reaction, `data-mascot` hints,
      `prefers-reduced-motion`
- [ ] `<pixie-mascot>` web component
- [ ] `@pixie/react`: `<Mascot text mood size animated palette lookAt auto />`, SSR-safe
- [ ] Component tests (jsdom)

### M7 Website (`apps/site`)
- [ ] Playground (live text, traits, mood picker, per-platform snippets)
- [ ] Gallery, docs page, reaction demo
- [ ] Builds clean; looked at in a browser

### M8 Native ports (spec + golden only, never new logic)
- [ ] Swift package: generator, `PixieView`, `swift test` against `spec/golden.json`
- [ ] Kotlin module: generator, Compose view, Gradle test against `spec/golden.json`

### M9 Ship readiness
- [ ] GitHub Actions per package, path-filtered
- [ ] Root README with per-platform usage, versioning policy
- [ ] Changesets config
- [ ] Final run of every test suite; fill in CLAUDE.md "Commands"

## Definition of done (every milestone)

1. Tests for that milestone pass and are quoted from a real run.
2. `git status` clean; work committed in small commits.
3. PLAN.md / CLAUDE.md / this file still tell the truth.
4. Anything visual was opened and looked at, not assumed.

## Known risks while building

- Letter-sound mapping may look random. If the lab grid says so, stop and rework traits (M3 gate).
- 16x16 may collide too often. Measure in M4 before freezing.
- Native ports may drift. The golden file is the only authority.
