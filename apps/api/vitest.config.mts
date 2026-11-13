import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Argon2 hashing is deliberately slow; allow for slow Windows/antivirus-scanned machines.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
