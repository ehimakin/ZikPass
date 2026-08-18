import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // physical-flow, enrollment-service, and (now) the Sprint 7 journey
    // cases all mutate the same on-disk runtime-state.json fixture with no
    // locking; running test files in parallel races those writes.
    fileParallelism: false
  }
});
