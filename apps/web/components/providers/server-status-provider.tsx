"use client";

import { createContext, useContext, useState, ReactNode } from "react";

/**
 * Poller state (deprecated - no longer used)
 */
export type PollerState = "idle" | "running" | "stopped" | "error";

/**
 * Poller status (deprecated - no longer used)
 */
export interface PollerStatus {
  state: PollerState;
  intervalMs: number;
  lastPollTime?: number;
  nextPollTime?: number;
  discoveredPRDs: number;
  error?: string;
}

/**
 * Queue item (deprecated - no longer used)
 */
export interface QueueItem {
  prdId: string;
  enqueuedAt: number;
  estimatedWaitMs: number;
  prd: {
    id: string;
    project: string;
    description: string;
  };
}

/**
 * Queue status (deprecated - no longer used)
 */
export interface QueueStatus {
  length: number;
  current: QueueItem | null;
  waiting: QueueItem[];
  waitingCount: number;
}

/**
 * Server initialization status
 * Web interface is read-only, so initialization is not needed
 */
export interface ServerInitStatus {
  initialized: boolean;
  loading: boolean;
  error?: string;
  executionsLoaded: number;
  pollingStarted: boolean;
}

/**
 * Server status context
 * Simplified for read-only Web interface
 */
interface ServerStatusContextValue {
  pollerStatus: PollerStatus | null;
  queueStatus: QueueStatus | null;
  initStatus: ServerInitStatus;
  refresh: () => Promise<void>;
}

const ServerStatusContext = createContext<ServerStatusContextValue | undefined>(
  undefined
);

interface ServerStatusProviderProps {
  children: ReactNode;
}

/**
 * Provider for server status
 *
 * Simplified version for read-only Web interface.
 * Execution control is handled through CLI, not Web UI.
 */
export function ServerStatusProvider({ children }: ServerStatusProviderProps) {
  const [pollerStatus, setPollerStatus] = useState<PollerStatus | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [initStatus, setInitStatus] = useState<ServerInitStatus>({
    initialized: true, // Auto-initialize for read-only mode
    loading: false,
    executionsLoaded: 0,
    pollingStarted: false,
  });

  /**
   * Refresh poller and queue status (no-op for read-only mode)
   */
  const refresh = async () => {
    // No-op - Web interface is read-only
    // Use CLI for execution control
  };

  return (
    <ServerStatusContext.Provider
      value={{ pollerStatus, queueStatus, initStatus, refresh }}
    >
      {children}
    </ServerStatusContext.Provider>
  );
}

/**
 * Hook to access server status
 */
export function useServerStatus() {
  const context = useContext(ServerStatusContext);
  if (!context) {
    throw new Error("useServerStatus must be used within ServerStatusProvider");
  }
  return context;
}
