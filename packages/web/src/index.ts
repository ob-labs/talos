/**
 * @talos/web - Talos Web UI Server
 *
 * This package provides the standalone Next.js server for the Talos Web UI.
 * The standalone build is copied to the standalone/ directory during build.
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Path to the standalone Next.js server.js file
 *
 * Note: In standalone mode, the server.js file is located at
 * standalone/apps/web/server.js (not standalone/server.js)
 */
export const WEB_SERVER_PATH = path.join(__dirname, "../standalone/apps/web/server.js");

/**
 * Path to the standalone static files directory
 */
export const WEB_STATIC_DIR = path.join(__dirname, "../standalone/apps/web/.next/static");

/**
 * Get the server path with fallback for different environments
 */
export function getServerPath(): string {
  try {
    // Try to resolve from the package
    return require.resolve("../standalone/apps/web/server.js");
  } catch {
    // Fallback to relative path
    return WEB_SERVER_PATH;
  }
}
