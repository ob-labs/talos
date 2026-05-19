import { join, basename, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_DIR = join(__dirname, "..");

export const TALOS_DIR = join(homedir(), ".talos");
export const REPOS_CACHE_DIR = join(TALOS_DIR, "repos");

export function workspaceNameFromProject(projectPath: string): string {
  return basename(projectPath);
}

export function workspaceDir(projectPath: string): string {
  return join(TALOS_DIR, workspaceNameFromProject(projectPath));
}

