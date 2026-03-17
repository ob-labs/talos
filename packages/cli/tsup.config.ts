import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: false,
  sourcemap: true,
  outDir: "dist",
  // Don't auto-externalize dependencies
  noExternal: [/^@talos\//],
  external: [
    "commander",
    "prompts",
    "node:*",
    "ink",
    "react",
    "open",
    // simple-git and its dependencies (they use dynamic require)
    "simple-git",
    "@kwsites/file-exists",
    "@kwsites/promise-deferred",
  ],
  async onSuccess() {
    // Replace @/ aliases with relative paths in built files
    const { promises } = await import('fs');
    const { join } = await import('path');
    const distPath = join(process.cwd(), 'dist');

    const files = await promises.readdir(distPath);
    const jsFiles = files.filter(f => f.endsWith('.js') && !f.endsWith('.map'));

    for (const file of jsFiles) {
      const filePath = join(distPath, file);
      let content = await promises.readFile(filePath, 'utf-8');

      // Replace @/ aliases with relative paths
      content = content
        .replace(/from ['"]\/client\//g, 'from "./client/')
        .replace(/from ['"]\/ui\//g, 'from "./ui/')
        .replace(/from ['"]\/utils\//g, 'from "./utils/')
        .replace(/from ['"]\/tasks\//g, 'from "./tasks/')
        .replace(/from ['"]\/config\//g, 'from "./config/');

      await promises.writeFile(filePath, content);
    }
  },
});
