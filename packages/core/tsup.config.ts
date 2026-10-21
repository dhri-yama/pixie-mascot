import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/dom.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    target: "es2022",
  },
  {
    // Script-tag bundle: defines <pixie-mascot> and window.Pixie.
    entry: { pixie: "src/browser.ts" },
    format: ["iife"],
    globalName: "PixieBundle",
    minify: true,
    target: "es2022",
  },
]);
