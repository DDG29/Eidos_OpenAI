import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 30000,
    pool: "threads",
    // The 160 000-particle shape tests are CPU-bound: half the cores keeps them inside the timeout on a busy machine.
    maxWorkers: "50%",
  },
});
