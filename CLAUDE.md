# CLAUDE.md

**Pixie**: a pixel-art mascot generator. Text in, deterministic retro sprite out, with moods and a
behavior engine. Design in [PLAN.md](PLAN.md), build log in [IMPLEMENTATION.md](IMPLEMENTATION.md),
usage in [README.md](README.md). Read PLAN.md before making structural changes.

## Status

All milestones built and tested (TypeScript, React, web component, website, Swift, Kotlin).
**Algorithm v1 is still a draft** (`spec/VERSIONS.md`): it has not been signed off by the owner, so it is
not frozen. Not published to any registry. CI workflows exist but have never run on a real runner.

## Invariants (never break these)

1. **Determinism.** Same normalized text + same `version` = identical grid on every platform. The
   generation path is a pure function of `(text, version, palette preset)`.
2. **No `Math.random()`, `Date`, locale, or environment reads** in the generator, traits, compose or
   behavior code of any language. Use the project's seeded PRNG only.
3. **Integers only in the grid path.** No floats, trig or `pow`. Division truncates toward zero. Behavior
   gaze thresholds are the one place doubles appear (pointer vectors).
4. **Frozen versions stay frozen.** Once a version is frozen, do not change its hashing, normalization,
   trait rules, parts, palettes, faces, rounding or rng call order. Any such change is a new version.
5. **The rng draw order is part of the algorithm.** Every code path draws the same numbers, even when a
   branch does not use them. Never add, remove or reorder a draw in a released version.
6. **No iteration over unordered collections** where order affects output.
7. **Zero runtime dependencies** in `packages/core`, and in the Swift and Kotlin generator code.
8. **Core never touches the network.** A meaning-aware mode would be an optional plug-in outside core.
9. **Users do not tune the look.** Public knobs: `size`, `mood`, `animated`, `auto`, `attention`, `palette`
   preset, `version`. Do not add appearance options without asking.
10. **Swift and Kotlin contain no logic that is not in the spec.** They are ports, proven only by `spec/golden.json`.

## Motion and shapes

22 body shapes in three families (soft, sharp, sinuous) and 6 marks; a snake is built whole from circles and is not
mirrored. The pose carries `lift, dx, lean, squash, wave, amp` (integers) and `applyMotion` in `compose` applies them;
motion tables live in `spec/motion.json` and reach Swift and Kotlin through `pnpm gen:native`. The behavior engine picks a
motion style from the sprite's body shape, so it needs `template` (all three ports and the DOM glue pass it).

## Walking (web only)

`walk` / `walkAround(host)` in `dom.ts` moves the mascot's element around the inside edge of its positioned parent (loop) or to
random spots and clicks (roam, seeded by the sprite) with CSS transforms (flipping with `scaleX(-1)` to face the way it goes). It is host behavior, not part of the sprite, the pose or the
golden file, and is **not ported** to Swift/Kotlin (native apps move views with their own layout and animation APIs).

## Smooth rendering (web only, experimental)

`toSmoothSVG` and the `smooth` option redraw the same 32x32 grid as rounded vector shapes (trace each color
region, round corners with Chaikin passes, shade clipped to the body). It is a renderer: it never touches the
generator or the golden file, uses floating point, and is **not ported** to Swift/Kotlin. Do not let it leak into
the generation path. If it is adopted, port it with its own tests rather than relaxing invariant 3.

## Layout

- `spec/` is the source of truth. Rules in markdown; art as JSON (`letters.json`, `parts/parts.json`,
  `palettes.json`, `faces/faces.json`); `golden.json` is the cross-platform contract.
- `packages/core` TypeScript generator, behavior, SVG, `dom.ts` (browser glue, `<pixie-mascot>`), `browser.ts`.
- `packages/react` the `<Mascot />` component.
- `packages/swift` and the root `Package.swift`; `packages/kotlin` (Gradle: `:pixie` core, `:pixie-compose` view).
- `apps/lab` internal art-review page. `apps/site` the public website.
- `scripts/` golden generator, variety measurement, native data generator.
- Dependency direction: `spec -> core -> react -> apps/*`. Packages never import from `apps/`. Swift and Kotlin
  never import JS packages.
- Two version numbers: algorithm version (`v1`, frozen once released) vs package semver. Never conflate them.
- Generated, do not hand-edit: `packages/swift/Sources/Pixie/Generated/SpecData.swift` and
  `packages/kotlin/pixie/src/main/kotlin/dev/pixie/SpecData.kt` (run `pnpm gen:native`; a test enforces it).

## Commands

```bash
pnpm install
pnpm test                   # all TS tests: core, DOM, React, golden, native-data sync
pnpm typecheck
pnpm build                  # core + react (also the script-tag bundle)
pnpm --filter @pixie/site build
pnpm --filter @pixie/lab dev    # :5174
pnpm --filter @pixie/site dev   # :5175
swift test                  # repo root. Uses Swift Testing (see the quirk below if the macro plugin is "not found")
(cd packages/kotlin && gradle test)
pnpm golden:update          # rewrite spec/golden.json (draft versions only)
pnpm gen:native             # regenerate Swift/Kotlin data after editing spec/
pnpm variety [count]        # collision rate
```

## Workflow rules

- **Commit often.** One logical change per commit, committed as soon as it works and its tests pass.
  Never leave finished work uncommitted. Do not push unless asked.
- Commit messages: short imperative subject, body explains why when not obvious. Keep the attribution
  trailer the environment asks for.
- Check `date` is sane before the first commit of a session; commit dates come from the system clock.
  (The owner's `~/.zshrc` once exported fake `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`; it was removed. If commits
  show an odd date, check `env | grep GIT_`.)
- **Output changes fail the golden tests on purpose.** Never "fix" that by regenerating `golden.json` once a
  version is frozen. While v1 is a draft you may run `pnpm golden:update`, but then all three languages must
  pass the new file before you commit, and say so in the commit message.
- Changing anything in `spec/` means: update the spec text, run `pnpm gen:native`, run `pnpm golden:update` (draft
  only), then run TS, Swift and Kotlin tests.
- New art (parts, faces, palettes) goes into `spec/` as data first.
- Keep the core small. Prefer deleting code to adding abstraction.
- Public API changes need a README update in the same change.

## Testing

- Golden: `spec/golden.json` must pass in TypeScript, Swift and Kotlin. It is the release gate.
- Mutation sanity check (done once): break one letter weight in a generated data file and confirm golden fails.
- Property tests: repeatable, never throws on any string, no NaN, indices 0..7, top row empty.
- DOM behavior is tested with jsdom and a fake clock. Visuals: open the lab (`apps/lab`) and look.
- Run tests before saying anything is done. Report failures as they are.

## Environment quirks seen so far

- `swift test` with only the Command Line Tools sometimes fails with "plugin for module 'TestingMacros' not found"
  on some runs, and passing extra environment variables triggers it. It is a toolchain quirk. Reliable way: loop
  `swift build --build-tests` until it prints "Build complete", then `swift test --skip-build`.
  SwiftUI's `@State` macro plugin is also missing there, so avoid `@State` in package code (use `@StateObject`).
- No iOS SDK and no Android SDK on the dev machine: iOS and Android targets are unverified.
- Foundation's JSON parser rejects lone surrogates, so golden inputs must be valid Unicode (the TS unit tests cover lone surrogates).
- In tool-run shells, `\uXXXX` escapes inside heredocs can be turned into literal characters; write such files with the editor tool.

## Open decisions (ask before deciding)

Freezing v1, final registry package names and the Swift package URL, whether to add a meaning-aware mode (v2),
Android and iOS verification, a hosted `/m/<text>.svg` endpoint.
