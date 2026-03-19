import { defineConfig } from "tsup";
import { copyFileSync, existsSync } from "fs";
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
    // Copy skill.md to dist for ralph-cli
    const skillSrcPath = join(process.cwd(), "assets", "skill.md");
    const skillDestPath = join(process.cwd(), "dist", "skill.md");

    if (existsSync(skillSrcPath)) {
      copyFileSync(skillSrcPath, skillDestPath);
      console.log("Copied skill.md to dist/skill.md");
    } else {
      console.warn(`Warning: ${skillSrcPath} not found. Ralph executor may not work correctly.`);
    }
  },
});
