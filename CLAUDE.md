# CLAUDE.md

**Pixie**: a pixel-art mascot generator: text in, deterministic retro sprite out. Full design in
[PLAN.md](PLAN.md). Read it before making structural changes.

## Status

Planning stage. No code yet. Update this section as milestones land.

## Invariants (never break these)

1. **Determinism.** Same normalized text + same `version` = identical grid, on every
   platform. The generation path is a pure function of `(text, version)`.
2. **No `Math.random()`, `Date`, locale, or environment reads** in `packages/core`.
   Use the project's seeded PRNG only.
3. **Integers only in the grid path.** No floats, trig, or `pow`. If you need a curve, use
   a lookup table or pre-drawn pixels.
4. **Frozen versions stay frozen.** Once a version ships, do not change its hashing,
   normalization, trait rules, parts, palettes, or rounding. Any such change is a new version.
5. **No iteration over unordered collections** (object keys, `Map`, `Set`) where order affects output.
6. **Zero runtime dependencies** in `packages/core`.
7. **Core never touches the network.** Any LLM/meaning mode is an optional plug-in outside core.
8. **Users do not tune the look.** Public knobs are limited to `size`, `mood`, `animated`,
   `palette` preset, `version`. Do not add appearance options without asking.

## Layout

- `spec/` is the source of truth, language-neutral. Rules, parts, faces, `golden.json`.
  Code implements the spec, not the other way around. Change the spec first.
- `packages/core/` TypeScript generator + `toSVG`.
- `packages/react/` React component over core.
- `packages/swift/`, `packages/kotlin/` hand ports, verified only by `spec/golden.json`.
- `apps/lab/` internal visual test page: many words rendered as a sprite grid, by mood.
- `apps/site/` public website (playground, gallery, docs). Imports packages through the workspace.
- Dependency direction: `spec -> core -> react -> apps/*`. Packages never import from `apps/`.
  Swift and Kotlin never import JS packages.
- Two version numbers: algorithm version (`v1`, frozen) vs package semver. Never conflate them.

## Workflow rules

- **Commit often.** One logical change per commit, committed as soon as it works and its
  tests pass. Never leave a finished piece of work uncommitted. Do not push unless asked.
- Commit messages: short imperative subject, body explains why when not obvious. Keep the
  attribution trailer the environment asks for.
- Check `date` is sane before the first commit of a session; commit dates come from the system clock.

- **Any change that alters output** for existing inputs fails the golden test. That is
  intended. Do not "fix" it by regenerating `golden.json`. Either revert, or create a new
  version and add its own golden entries.
- Regenerate golden files only when adding a new version or new inputs, and say so in the commit.
- New art (parts, faces) goes in `spec/` as data first, then code reads it.
- Native ports: never add logic that is not in the spec. If a port needs something new, update
  the spec and the other ports' tests.
- Keep the core small. Prefer deleting code to adding abstraction.
- Public API changes need a README update in the same change.

## Testing

- Golden: `spec/golden.json` must pass in every package. This is the release gate.
- Property: same input repeated gives same output; never throws; no `NaN`/`Infinity` in output.
- Visual: when parts, traits, or palettes change, regenerate the lab grid and review it by eye.
- Run tests before saying anything is done. Report failures as they are.

## Conventions

- TypeScript strict mode. No `any` in core.
- Traits are integers 0..100.
- Sprite = `{ grid, palette, traits, version }`. Grid cells are palette indices.
- Rendering uses crisp edges (`shape-rendering="crispEdges"`, nearest-neighbor scaling).
- Commit messages: short imperative subject, explain why in the body when it is not obvious.

## Commands

Fill in once tooling exists (package manager, build, test, lab dev server).

## Open decisions

See "Open questions" in [PLAN.md](PLAN.md). Ask the user before deciding these: species model,
body deformation, meaning-aware mode, registry package names (the product name is Pixie) and license.
