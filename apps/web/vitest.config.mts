import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps `jsx: preserve` for Next.js, so tell the test transformer how to compile JSX.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "node", // component tests opt in with `// @vitest-environment jsdom`
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 20_000,
  },
});
