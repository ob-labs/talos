"use client";

import { useEffect, useState } from "react";
import { Badge, Card } from "@/components/ui";

interface PollerStatus {
  state: "started" | "stopped";
  intervalMs: number;
  lastPollTime?: number;
  nextPollTime?: number;
  discoveredPRDs: string[];
  error?: string;
}

interface QueueItem {
  prdId: string;
  project: string;
  estimatedWaitMs?: number;
}

interface QueueStatus {
  length: number;
  current: QueueItem | null;
  waiting: QueueItem[];
  waitingCount: number;
}

interface SystemStatusBarProps {
  onShowDetails?: () => void;
}

export function SystemStatusBar({ onShowDetails }: SystemStatusBarProps) {
  const [pollerStatus, setPollerStatus] = useState<PollerStatus | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial status
  useEffect(() => {
    fetchStatus();
    // Refresh status every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const [pollerRes, queueRes] = await Promise.all([
        fetch("/api/execute/poller/status"),
        fetch("/api/execute/queue"),
      ]);

      if (pollerRes.ok) {
        const pollerData = await pollerRes.json();
        setPollerStatus(pollerData);
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setQueueStatus(queueData);
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch system status:", error);
      setLoading(false);
    }
  }

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  const isPollerRunning = pollerStatus?.state === "started";
  const queueLength = queueStatus?.length ?? 0;
  const currentTaskId = queueStatus?.current?.prdId || null;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all"
      onClick={onShowDetails}
    >
      <div className="flex items-center gap-4 px-4 py-2">
        {/* Poller Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isPollerRunning
                ? "bg-green-500 dark:bg-green-400 animate-pulse"
                : "bg-red-500 dark:bg-red-400"
            }`}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Poller: {isPollerRunning ? "Running" : "Stopped"}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />

        {/* Queue Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Queue: {queueLength} task(s)
          </span>
        </div>

        {/* Current Task */}
        {currentTaskId && (
          <>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                Executing:
              </span>
              <span className="text-sm font-mono text-gray-900 dark:text-white truncate">
                {currentTaskId}
              </span>
            </div>
          </>
        )}

        {/* Next Poll Time */}
        {!loading && pollerStatus && isPollerRunning && pollerStatus.nextPollTime && (
          <>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <span className="text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
              Next scan: {formatTimestamp(pollerStatus.nextPollTime)}
            </span>
          </>
        )}

        {/* Chevron */}
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Card>
  );
}

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemStatusModal({ isOpen, onClose }: SystemStatusModalProps) {
  const [pollerStatus, setPollerStatus] = useState<PollerStatus | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  // Auto-refresh every 2 seconds when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  async function fetchStatus() {
    try {
      const [pollerRes, queueRes] = await Promise.all([
        fetch("/api/execute/poller/status"),
        fetch("/api/execute/queue"),
      ]);

      if (pollerRes.ok) {
        const pollerData = await pollerRes.json();
        setPollerStatus(pollerData);
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setQueueStatus(queueData);
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch system status:", error);
      setLoading(false);
    }
  }

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatInterval(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}minutes`;
    }
    return `${seconds}秒`;
  }

  const isPollerRunning = pollerStatus?.state === "started";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            System Status Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Loading status...
            </div>
          ) : (
            <>
              {/* Poller Status */}
              <Card>
                <div className="p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Poller Service Status
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <Badge
                        variant={isPollerRunning ? "green" : "red"}
                        className="ml-2"
                      >
                        {isPollerRunning ? "Running" : "Stopped"}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Poll interval:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {pollerStatus ? formatInterval(pollerStatus.intervalMs) : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Last scan:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {formatTimestamp(pollerStatus?.lastPollTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Next scan:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">
                        {formatTimestamp(pollerStatus?.nextPollTime)}
                      </span>
                    </div>
                  </div>
                  {pollerStatus?.discoveredPRDs && pollerStatus.discoveredPRDs.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Discovered PRD:
                      </span>
                      <div className="mt-2 space-y-1">
                        {pollerStatus.discoveredPRDs.map((prdId) => (
                          <div
                            key={prdId}
                            className="text-xs font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded"
                          >
                            {prdId}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pollerStatus?.error && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        Error: {pollerStatus.error}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Queue Status */}
              <Card>
                <div className="p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Execution Queue Status
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Queue length:</span>
                      <span className="ml-2 text-gray-900 dark:text-white font-medium">
                        {queueStatus?.length ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Waiting:</span>
                      <span className="ml-2 text-gray-900 dark:text-white font-medium">
                        {queueStatus?.waitingCount ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Current Task */}
                  {queueStatus?.current && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Executing Task
                      </h4>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">PRD ID:</span>
                            <span className="ml-2 font-mono text-gray-900 dark:text-white">
                              {queueStatus.current.prdId}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Project name:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">
                              {queueStatus.current.project}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Waiting Queue */}
                  {queueStatus?.waiting && queueStatus.waiting.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Waiting Queue
                      </h4>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {queueStatus.waiting.map((item, index) => (
                          <div
                            key={item.prdId}
                            className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                    #{index + 1}
                                  </span>
                                  <span className="font-mono text-sm text-gray-900 dark:text-white truncate">
                                    {item.prdId}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                  {item.project}
                                </p>
                              </div>
                              {item.estimatedWaitMs && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                                  Est. wait ~{Math.ceil(item.estimatedWaitMs / 60000)}minutes
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
