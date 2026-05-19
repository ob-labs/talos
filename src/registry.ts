import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { PACKAGE_DIR, REPOS_CACHE_DIR } from "./paths.js";

export function repoSlug(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function syncRepo(url: string, ref: string | undefined, cachePath: string): void {
  mkdirSync(join(cachePath, ".."), { recursive: true });

  if (existsSync(cachePath)) {
    try {
      execSync(`git -C "${cachePath}" pull --ff-only`, { stdio: "pipe" });
    } catch {
      // Pull failed, use cached version
    }
    return;
  }

  const refArg = ref ? ["--branch", ref] : [];
  const args = ["clone", "--depth", "1", ...refArg, url, cachePath];
  execSync(args.join(" "), { stdio: "pipe" });
}

export function resolveBuiltinWorkflowDir(name: string): string {
  return join(PACKAGE_DIR, "workflows", name);
}

export function resolveGitWorkflowDir(url: string, ref: string | undefined): string {
  const slug = repoSlug(url);
  const cachePath = join(REPOS_CACHE_DIR, slug);
  syncRepo(url, ref, cachePath);
  return cachePath;
}
