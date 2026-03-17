import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/entry.ts",
    "src/storage/storage.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  outDir: "dist",
  external: [
    "@talos/*",
    "simple-git",
    "tinyexec",
    "chokidar",
    "socket:*",
    "node:*",
  ],
});
