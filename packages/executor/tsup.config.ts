import { defineConfig } from "tsup";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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
  async onSuccess() {
    // Copy skill.md to dist/assets for ralph-cli
    const skillSrcPath = join(process.cwd(), "assets", "skill.md");
    const assetsDir = join(process.cwd(), "dist", "assets");

    // Ensure assets directory exists
    mkdirSync(assetsDir, { recursive: true });

    if (existsSync(skillSrcPath)) {
      const skillDestPath = join(assetsDir, "skill.md");
      copyFileSync(skillSrcPath, skillDestPath);
      console.log("Copied skill.md to dist/assets/skill.md");
    } else {
      console.warn(`Warning: ${skillSrcPath} not found. Ralph executor may not work correctly.`);
    }
  },
});
