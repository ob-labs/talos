"use client";

import { useServerStatus } from "./server-status-provider";

/**
 * Initialization status banner
 *
 * Simplified for read-only Web interface.
 * Always returns null - no initialization needed for read-only mode.
 */
export function InitBanner() {
  const { initStatus } = useServerStatus();

  // Don't show banner in read-only mode
  // Web interface is for viewing only, execution control is via CLI
  return null;
}
