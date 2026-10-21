# Pixie: Plan

Name: **Pixie** (the Fight Club one). The npm/package-registry names have not been
checked yet; confirm availability (`pixie` is likely taken) before first publish.

## Goal

A package where a developer passes a word or sentence and gets back a retro,
pixel-art mascot. The text decides the look. Users do not tune the look.

- `"bubbanbbebb"` -> round, soft, calm
- `"jsakkkwaakiyy"` -> sharp, spiky, jittery
- Same text + same version -> same mascot, always, on every platform.
- Works in React/web first, then Swift and Kotlin.
- The mascot has expressions and reacts to the UI it lives in.

## Non-goals

- No user-facing customization of the art (no color pickers, no part pickers).
  The only knobs: `size`, `mood`, `animated`, `palette` preset, `version`.
- No smooth/vector blobs. Pixel grid only.
- No runtime network calls in the core. Meaning-aware (LLM) mode is an optional plug-in, never required.

Prior art: [blobatar](https://github.com/Alain00/blobatar) (smooth vector avatars
from a hash, MIT). Ours differs by pixel style and by mapping the *sound/meaning*
of the text to shape. Do not copy its code without checking the license terms.

## Core decisions

| Topic | Decision | Why |
|---|---|---|
| Representation | Sprite = grid of palette indices (start 16x16) + palette | Integer-only, so identical on every platform |
| Core language | TypeScript, zero dependencies | Fastest to iterate, runs everywhere |
| Native | Hand ports to Swift and Kotlin, checked by golden file | No FFI/Rust unless the algorithm outgrows hand porting |
| Randomness | One seeded PRNG written by us. `Math.random()` is banned in core. | Determinism |
| Hash | FNV-1a over UTF-8 bytes of normalized text | Specified, portable |
| Normalization | Unicode NFC, trim, lowercase, collapse whitespace, cap length | Same text -> same hash |
| Math | Integers / fixed-point only in core. No trig, no float in the grid path. | No cross-platform drift |
| Versioning | `version` is part of the API. Frozen versions never change. | Stored avatars must not change under users |
| Art | Hand-authored parts library + procedural silhouette, mirrored left-to-right | Looks designed, not noisy |

## Pipeline

```
text -> normalize -> hash/seed
     -> features (sound + optional meaning) -> traits {roundness, heft, energy, chaos}
     -> body template + parts + face anchors   (seeded choices)
     -> palette (4 colors from a curated pool)
     -> Sprite { grid, palette, traits, version }
     -> renderer (SVG rects / Canvas / SwiftUI / Compose)
```

The behavior layer (expressions, attention) is separate and runs only on live
renderers. Static output is just the sprite with a neutral face.

## Traits (the contract between text and art)

Each trait is an integer 0..100.

- `roundness`: corner cuts, spikes, ears/horns
- `heft`: width vs height
- `energy`: limb count, animation tempo
- `chaos`: symmetry breaks, asymmetric parts

Sound rules (phonetic mode): b m n l w o u -> round; k t x z q j p i e -> sharp;
vowel ratio, repetition, rare-letter density feed energy and chaos. Exact weights
live in `spec/traits.md` and are frozen per version.

## Expressions

v1 ships 6: neutral, happy, sad, surprised, thinking, sleepy.
Later: angry, love, confused, excited, smug, worried.

- Face = swappable patch set (eyes, mouth, props) on body-defined anchor points.
- Gaze = 8 directions + center, snapped (no interpolation).
- Idle: 2-frame bob, blink every 3-6s. Reactions play once, then settle.
- Timing comes from `energy` and `chaos`.
- Priority: app-set mood > reaction > idle.
- `prefers-reduced-motion` -> static frame.

## Repo layout

One monorepo: library packages (published) and apps (not published).

```
pixie/
  CLAUDE.md
  PLAN.md
  README.md
  package.json, pnpm-workspace.yaml   # pnpm workspaces for the JS side
  spec/                 # source of truth, language-neutral
    traits.md           # text -> traits rules
    sprite.md           # grid format, anchors, layering
    parts/              # hand-authored pixel parts (JSON)
    faces/              # expression patches (JSON)
    golden.json         # input -> expected grid hash, per version
  packages/             # PUBLISHED
    core/               # TS generator + toSVG
    react/              # <Mascot />
    swift/              # later
    kotlin/             # later
  apps/                 # NOT published
    lab/                # internal test page: N words as a grid, by mood
    site/               # public website: playground, gallery, docs, reaction demo
  .github/workflows/    # one workflow per package, path-filtered
```

Dependency direction: `spec -> core -> react -> apps/*`. Packages never import from
`apps/`. Swift and Kotlin never import the JS packages; they implement the spec and are
tested against `spec/golden.json`.

Two version numbers, never conflated: the **algorithm version** (`v1`, `v2`; lives in the
spec, frozen once shipped) and the **package version** (semver; bug fixes and API).
Tooling: pnpm workspaces, Changesets for npm releases. SwiftPM needs `Package.swift` at
the repo root, so start with a root `Package.swift` pointing into `packages/swift`.

## Milestones

Each milestone ends with something you can look at or a green test.

1. **Foundations.** Normalizer, FNV-1a hash, seeded PRNG, `golden.json` harness,
   CI that fails on any golden diff. No art yet.
2. **First sprite.** One species, 4 body templates, ~10 parts, mirrored
   generator, `toSVG`. Lab page renders 200 words in a grid.
3. **Tune the mapping.** Judge by eye: do round words look round, sharp words
   sharp? Adjust trait rules. Freeze as `v1` only when satisfied.
   **Gate:** if the mapping looks random, stop and reconsider before building more.
4. **Variety check.** Generate 100k random strings, measure unique-sprite rate.
   Increase grid/parts if collisions are high.
5. **Expressions + animation.** 6 faces, idle/blink, mood prop, gaze snapping.
6. **React package.** `<Mascot text mood size animated />`, SSR-safe.
7. **Auto-reaction.** Optional `auto` mode: hover/click/focus/typing/idle reactions,
   `data-mascot` hints, attention state machine.
8. **Native ports.** Swift, then Kotlin, each against `golden.json`.
9. **Website (`apps/site`).** Playground (type text, see mascot + traits + snippets),
   gallery, docs, auto-reaction demo. Needs milestones 5-7. Deployed independently of
   package releases. Optional later: hosted `/m/<text>.svg` endpoint.
10. **Docs + publish.** README with per-platform snippets, versioning policy.

## Testing

- **Golden:** ~500 inputs (gibberish, words, sentences, emoji, empty, very long,
  non-Latin) -> expected grid hash. Runs on every package.
- **Property:** same input 1000x in one process gives one output; no NaN/Infinity;
  never throws on any string.
- **Matrix:** Node (LTS versions) + Chromium/Firefox/WebKit via Playwright.
- **Visual:** lab page screenshot reviewed by a human for each version bump.

## Versioning policy

- `v1` frozen once shipped. Any change to hashing, normalization, trait rules,
  parts, palettes, or rounding is a new version.
- Old versions stay in the package (or their golden files stay green).
- Default version = latest; apps that store avatars should store `{text, version}`.

## Risks

| Risk | Mitigation |
|---|---|
| Phonetic mapping looks random | Milestone 3 gate, judged by eye on the lab grid |
| 16x16 gives too many collisions | Milestone 4 measurement, move to 24x24 or add parts |
| Native ports drift | Integer-only core, shared golden file blocks release |
| Art quality | Hand-authored parts, not purely procedural pixels |
| Offensive/unfortunate shapes | Review parts library; fuzz-render and eyeball outliers |

## Open questions

1. Species: one creature type for all, or text picks a species?
2. Do bodies deform on expressions (squash/lean) or only faces swap?
3. Meaning-aware mode: ship a small built-in lexicon, an optional LLM plug-in, or neither in v1?
4. Published package names per registry (npm, SwiftPM, Maven) and license. The product name is Pixie.
