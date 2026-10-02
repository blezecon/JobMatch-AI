import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

// Two projects because the pure-logic tests are faster in node, while the
// regression tests for the React render loop need a DOM.
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        resolve: { alias },
        test: { name: "node", include: ["test/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        resolve: { alias },
        test: { name: "dom", include: ["test/**/*.test.tsx"], environment: "jsdom" },
      },
    ],
  },
});