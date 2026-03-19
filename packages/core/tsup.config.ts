import { defineConfig } from "tsup";

export default defineConfig([
  // Main entry points - keep @talos/* external for library use
  {
    entry: ["src/index.ts", "src/storage/storage.ts"],
    format: ["esm"],
    dts: true,
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
  },
  // Daemon entry point - bundle all dependencies for standalone use
  {
    entry: ["src/entry.ts"],
    format: ["esm"],
    dts: true,
    treeshake: true,
    splitting: false,
    sourcemap: true,
    outDir: "dist",
    noExternal: [/^@talos\//],
    external: ["simple-git", "tinyexec", "chokidar", "socket:*", "node:*"],
  },
]);
