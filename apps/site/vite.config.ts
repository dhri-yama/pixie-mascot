import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const p = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Use the library sources directly so the site always shows the code in this repo.
  resolve: {
    alias: {
      "pixie-mascot/dom": p("../../packages/core/src/dom.ts"),
      "pixie-mascot": p("../../packages/core/src/index.ts"),
      "pixie-mascot-react": p("../../packages/react/src/index.tsx"),
    },
  },
  server: { port: 5175, strictPort: true },
});
