import { build } from "esbuild";
import { chmod } from "node:fs/promises";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

await build({
  entryPoints: ["src/cli.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  banner: { js: "#!/usr/bin/env node" },
  define: {
    "import.meta.env.PKG_VERSION": JSON.stringify(pkg.version),
  },
  external: ["gray-matter"],
  logLevel: "info",
});

await chmod("dist/cli.js", 0o755);
