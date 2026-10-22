# pixie-mascot-react

React component for [pixie-mascot](https://github.com/dhri-yama/pixie-mascot): deterministic pixel-art mascots from text,
with moods, motion, pointer following and optional walking.

```bash
npm install pixie-mascot-react
```

```tsx
import { Mascot } from "pixie-mascot-react";

<Mascot text={user.name} size={64} />
<Mascot text="helper" mood={loading ? "thinking" : "happy"} />
<Mascot text="helper" auto />            {/* reacts to hover, click, typing, form errors */}
<Mascot text="helper" walk="roam" />     {/* wanders around its positioned parent */}
```

Server-rendered markup is included, so it is safe for Next.js and other SSR. MIT
