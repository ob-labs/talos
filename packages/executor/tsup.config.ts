import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/ralph-cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  outDir: "dist",
  // Bundle @talos/* dependencies for ralph-cli to work standalone
  noExternal: [/^@talos\//],
});
