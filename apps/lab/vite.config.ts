import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@pixie/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)) },
  },
  server: { port: 5174, strictPort: true },
});
