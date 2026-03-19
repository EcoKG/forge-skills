import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    include: ["tests/**/*.test.js"],
    exclude: ["node_modules", "dist", ".forge"],
    pool: "forks",
    poolOptions: { forks: { maxForks: 1 } },
  },
});
