import * as path from "path";
import { LocalStorageEngine } from "./storage";

/**
 * Initialize a Talos project directory structure
 * Creates .talos directory with initial config file
 *
 * @param repoRoot - Repository root directory path
 * @throws Error if directory creation or file writing fails
 */
/**
 * Initial Talos project configuration
 */
export interface TalosProjectConfig {
  tasks: unknown[];
  version: string;
}

export async function initializeTalosProject(
  repoRoot: string
): Promise<void> {
  const storage = new LocalStorageEngine(repoRoot);

  // Create .talos directory (LocalStorageEngine's ensureDir will not error if it exists)
  await storage["ensureDir"](".talos");

// Create initial config file (only if it doesn't exist)
  const configExists = await storage.fileExists(path.join(".talos", "config.json"));
  if (!configExists) {
    const initialConfig: TalosProjectConfig = {
      tasks: [],
      version: "1.0",
    };
    await storage.writeJSON(path.join(".talos", "config.json"), initialConfig);
  }
}
