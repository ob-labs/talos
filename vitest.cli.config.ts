import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@talos/types": path.resolve(__dirname, "./packages/types/src/index.ts"),
      "@talos/git": path.resolve(__dirname, "./packages/git/src/index.ts"),
      "@talos/storage": path.resolve(__dirname, "./packages/storage/src/index.ts"),
      "@talos/task-manager": path.resolve(__dirname, "./packages/task-manager/src/index.ts"),
    },
  },
  test: {
    include: ["**/packages/cli/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    globals: true,
    environment: "node",
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
