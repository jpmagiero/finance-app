import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // better-sqlite3 e um modulo nativo sincrono; forks e o pool mais estavel.
    pool: "forks",
    setupFiles: ["./src/test/setup.ts"],
  },
});
