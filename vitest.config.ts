import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "pixie-mascot/dom": src("./packages/core/src/dom.ts"),
      "pixie-mascot": src("./packages/core/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
