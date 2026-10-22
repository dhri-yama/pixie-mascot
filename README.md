# Pixie

Type a word or a sentence, get a retro pixel-art mascot. The **sound** of the text decides the look:
soft sounds (`bubbanbbebb`) make round, cute creatures; sharp sounds (`jsakkkwaakiyy`) make spiky ones.
Same text and same algorithm version give the same mascot on every platform.

Mascots have six moods (neutral, happy, sad, surprised, thinking, sleepy), blink often (sometimes twice), and move
in a way that fits their body: round ones bounce and squash, tall ones waddle, clouds drift, crystals pulse and snakes
slither. They follow the pointer some of the time and look away the rest, jump when startled, fall asleep when
ignored, and can react to the UI around them.

> Status: working and tested, **not published yet**. Package names (`@pixie/core`, `@pixie/react`,
> `dev.pixie`, the Swift package) are placeholders until a registry check. Algorithm v1 is still a
> **draft**: its output may change until it is frozen (see [spec/VERSIONS.md](spec/VERSIONS.md)).

## Use it

### React

```tsx
import { Mascot } from "@pixie/react";

<Mascot text={user.name} size={64} />                       // alive: blinks, follows the pointer
<Mascot text="helper" mood={loading ? "thinking" : "happy"} />
<Mascot text="helper" auto />                               // reacts to hover, click, typing, form errors
<Mascot text="static" animated={false} />                   // one still frame, also fine on the server
```

Hints for `auto`: `data-mascot="worried"` on any element makes the mascot take that mood while the pointer is
over it; `data-mascot-ignore` on an element or ancestor opts it out. A focused password field makes the mascot
shut its eyes.

### Web component, any framework

```js
import { definePixieElement } from "@pixie/core/dom";
definePixieElement();
```

```html
<pixie-mascot text="bubba" size="96"></pixie-mascot>
<pixie-mascot text="bubba" mood="happy" auto></pixie-mascot>
```

A script-tag build (`dist/pixie.global.js`) defines the element and `window.Pixie` for pages without a bundler.

### Node, SVG, emails, READMEs

```ts
import { generate, toSVG, describe } from "@pixie/core";

const sprite = generate("bubbanbbebb");
const svg = toSVG(sprite.grid, sprite.colors, { size: 96, label: describe(sprite) });
```

### SwiftUI (iOS 16+, macOS 13+)

```swift
import Pixie

PixieView(text: "bubbanbbebb").frame(width: 96, height: 96)
PixieView(text: "helper", mood: isLoading ? .thinking : .happy)

let pixie = PixieController(text: "helper")           // drive it from code, or make views matter to it
PixieView(text: "helper", controller: pixie)
Button("Delete") { }.pixieTarget(pixie, mood: .sad)
```

Add the package from this repository's URL (`Package.swift` is at the root).

### Compose (Kotlin)

```kotlin
import dev.pixie.Mood
import dev.pixie.compose.PixieMascot

PixieMascot(text = "bubbanbbebb", modifier = Modifier.size(96.dp))
PixieMascot(text = "helper", mood = if (loading) Mood.Thinking else Mood.Happy)
```

`dev.pixie:pixie` is the plain Kotlin/JVM core (generator, behavior, SVG); `dev.pixie:pixie-compose` adds the
composable.

### Options

Only a few, on purpose. Users do not tune the look.

| Option | Meaning |
|---|---|
| `text` | Any string. It is normalized first (Unicode NFC, ASCII lowercase, whitespace collapsed, 128 code points) |
| `mood` | Set by your app. Leave unset and the mascot decides |
| `animated` | `false` gives one still frame |
| `walk` | Web only. `true` / `"loop"`: walk around the inside edge of the positioned parent (a street around a block), pausing at corners. `"roam"`: wander to random spots and to wherever you click. It flips to face the way it goes (`<Mascot walk="roam" />`, `walk` attribute, or `walkAround(el, { mode })`) |
| `smooth` | Web only for now: draw rounded vector shapes instead of square pixels (`<Mascot smooth />`, `smooth` attribute, `toSmoothSVG`) |
| `attention` | `always` / `sometimes` / `never` follow the pointer |
| `palette` | `gameboy`, `mono`, `amber`, or the curated default |
| `version` | Pin the algorithm (generator functions only) |

## How it works

1. Normalize the text and hash it (FNV-1a) into a seed for a small integer-only PRNG (mulberry32).
2. Each letter carries a bit of roundness, sharpness, weight and rarity ([spec/letters.json](spec/letters.json)).
   The totals become four traits 0..100: **roundness, heft, energy, chaos** ([spec/traits.md](spec/traits.md)).
3. The traits pick one of 22 body shapes with their own proportions: soft (ball, egg, pear, capsule, dome, cloud,
   head-on-body, box, mushroom, bell, drop, jellyfish), sharp (star, crystal, wedge, hexagon, kite, shield,
   hourglass) and sinuous (coiled snake, cobra, caterpillar). Text full of hissing, slithering letters (s z x h w y l)
   often becomes a snake. Then come parts (ears, horns, wings, arms, feet, claws), a tail on one side, a marking
   (belly patch, spots, stripes, cheeks or a forehead gem), eyes, and a palette from a curated pool. The left half is
   built and mirrored; chaos breaks the symmetry; snakes are drawn whole.
4. A behavior state machine ([spec/behavior.md](spec/behavior.md)) adds blinking, a motion style per body shape
   (bounce, sway, waddle, slither, float, pulse: squash and stretch, lean, wave, hop), jumps and droops for moods,
   attention (follow, wander, focus, asleep) and moods. It is pure and seeded, so it is testable and portable.

Phonetics only: meaning is not used (`razor wire` sounds round, so it looks round). A meaning-aware mode is a
possible v2.

## Repo layout

```
spec/            the contract: rules, art data, golden.json
packages/core    TypeScript generator, behavior, SVG, DOM glue, <pixie-mascot>
packages/react   <Mascot />
packages/swift   Swift port + SwiftUI view        (Package.swift at the repo root)
packages/kotlin  Kotlin/JVM port + Compose view   (Gradle build)
apps/lab         internal page for judging the art
apps/site        public website
scripts/         golden file, variety measurement, native data generator
```

Swift and Kotlin never import the TypeScript. All three implementations are checked against
[spec/golden.json](spec/golden.json): 500 inputs with seed, traits, shape, anchors, colors, grid hashes for every
mood and a gaze+blink+bob pose, SVG hashes, plus six scripted behavior traces. The art lives in `spec/` as JSON
and is turned into Swift and Kotlin source by `pnpm gen:native`.

## Develop

```bash
pnpm install
pnpm test                 # TypeScript: core, DOM (jsdom), React, golden, native-data sync
pnpm typecheck
pnpm build
pnpm --filter @pixie/lab dev    # http://localhost:5174, judge the art
pnpm --filter @pixie/site dev   # http://localhost:5175, the website

swift test                      # from the repo root
cd packages/kotlin && gradle test

pnpm golden:update        # draft versions only; see CLAUDE.md
pnpm gen:native           # after editing anything in spec/
pnpm variety              # collision rate over 100k random strings
```

Quality numbers for v1 are recorded in [spec/VERSIONS.md](spec/VERSIONS.md).

## Known limits

- Algorithm v1 is a draft. Freeze it (and announce the version policy) before storing avatars long term.
- The `smooth` look exists only in the TypeScript/web package. It is a renderer on top of the same 32x32 grid, uses floating point, and is not part of the golden file. Swift and Kotlin draw square pixels until it is ported.
- Sound only, no meaning. English-style letters drive the traits; other scripts fall back to the hash.
- 32x32 gives about 0.04% collisions among 100k distinct random strings (35 of them shared a look with another).
- Swift: verified on macOS (golden, behavior, off-screen SwiftUI render). The iOS code paths compile only
  against macOS here; the iOS SDK was not available.
- Kotlin: verified on desktop JVM with an off-screen Compose render. The Android target was not built (no Android SDK).
- CI workflows are written but have not run on a real runner yet.

## License

MIT
