import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2022",
  external: ["react", "@pixie/core", "@pixie/core/dom"],
});
