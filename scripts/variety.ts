// How often do different inputs give the same sprite? Run: pnpm variety [count]
import { generate } from "../packages/core/src";
import { createRng } from "../packages/core/src/rng";

const N = Number(process.argv[2] ?? 100_000);
const rng = createRng(424242);
const seen = new Map<string, number>();
const shapes = new Map<string, number>();
const inputs = new Set<string>();
while (inputs.size < N) {
  let s = "";
  const len = 4 + rng.int(9);
  for (let j = 0; j < len; j++) s += String.fromCharCode(97 + rng.int(26));
  inputs.add(s);
}
for (const s of inputs) {
  const sp = generate(s);
  const key = sp.grid.join("") + sp.colors.join();
  seen.set(key, (seen.get(key) ?? 0) + 1);
  const shape = sp.body.join("");
  shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
}
const dupes = N - seen.size; // distinct inputs that landed on an identical sprite
console.log(`${N} distinct random strings (4-12 letters)`);
console.log(`  unique sprites (shape+colors): ${seen.size} (${((seen.size / N) * 100).toFixed(2)}%), repeats: ${dupes}`);
console.log(`  unique silhouettes+faces (ignoring colors): ${shapes.size}`);
