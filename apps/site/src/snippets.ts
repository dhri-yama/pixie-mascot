export type Platform = "react" | "web" | "swift" | "kotlin" | "node";

export const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: "react", label: "React" },
  { id: "web", label: "Web component" },
  { id: "swift", label: "Swift" },
  { id: "kotlin", label: "Kotlin" },
  { id: "node", label: "Node / SVG" },
];

export function snippet(platform: Platform, text: string): string {
  const t = JSON.stringify(text);
  switch (platform) {
    case "react":
      return `import { Mascot } from "pixie-mascot-react";

<Mascot text=${t} size={96} />

// reacts to your app
<Mascot text=${t} mood={loading ? "thinking" : "happy"} />

// reacts to the page: hover, click, typing, form errors
<Mascot text=${t} auto />`;
    case "web":
      return `import { definePixieElement } from "pixie-mascot/dom";
definePixieElement();

// anywhere in your HTML
<pixie-mascot text=${t} size="96"></pixie-mascot>
<pixie-mascot text=${t} mood="happy" auto></pixie-mascot>`;
    case "swift":
      return `import Pixie

PixieView(text: ${t})
    .frame(width: 96, height: 96)

// reacts to your app
PixieView(text: ${t}, mood: isLoading ? .thinking : .happy)`;
    case "kotlin":
      return `import dev.pixie.Mood
import dev.pixie.compose.PixieMascot

PixieMascot(text = ${t}, modifier = Modifier.size(96.dp))

// reacts to your app
PixieMascot(text = ${t}, mood = if (loading) Mood.Thinking else Mood.Happy)`;
    case "node":
      return `import { generate, toSVG, describe } from "pixie-mascot";

const sprite = generate(${t});
const svg = toSVG(sprite.grid, sprite.colors, {
  size: 96,
  label: describe(sprite),
});
// <svg ...>, the same on every machine`;
  }
}
