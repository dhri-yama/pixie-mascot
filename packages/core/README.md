# pixie-mascot

Type a word or a sentence, get a deterministic retro pixel-art mascot. The sound of the text decides the look.
Same text and same algorithm version give the same mascot, on every platform.

```bash
npm install pixie-mascot
```

```ts
import { generate, toSVG, describe } from "pixie-mascot";

const sprite = generate("bubbanbbebb");
const svg = toSVG(sprite.grid, sprite.colors, { size: 96, label: describe(sprite) });
```

```js
// Web component, any framework
import { definePixieElement } from "pixie-mascot/dom";
definePixieElement();
// <pixie-mascot text="bubba" size="96" mood="happy" auto walk="roam"></pixie-mascot>
```

A script-tag build is at `dist/pixie.global.js` (also via jsDelivr and unpkg). For React use `pixie-mascot-react`.
Swift and Kotlin ports and the full docs are in the repository: https://github.com/dhri-yama/pixie-mascot

MIT
