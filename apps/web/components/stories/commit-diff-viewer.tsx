"use client";

import { useEffect, useState } from "react";

export interface CommitDiffViewerProps {
  hash: string;
  isOpen: boolean;
  onClose: () => void;
}

interface CommitDiffData {
  hash: string;
  message: string;
  author: string;
  date: string;
  diff: string;
}

/**
 * CommitDiffViewer component for displaying commit diff in a modal
 *
 * Features:
 * - Fetches commit diff from /api/commits/[hash]/diff
 * - Displays commit metadata (hash, message, author, date)
 * - Syntax highlighting for diff (red for deletions, green for additions)
 * - Modal overlay with close button
 * - Loading and error states
 */
export function CommitDiffViewer({ hash, isOpen, onClose }: CommitDiffViewerProps) {
  const [commitData, setCommitData] = useState<CommitDiffData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch commit diff when hash changes or modal opens
  useEffect(() => {
    if (!isOpen || !hash) return;

    const fetchCommitDiff = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/commits/${encodeURIComponent(hash)}/diff`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch commit diff: ${response.status}`);
        }

        const data: CommitDiffData = await response.json();
        setCommitData(data);
      } catch (err) {
        console.error("Failed to fetch commit diff:", err);
        setError((err as Error).message || "加载提交详情失败");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommitDiff();
  }, [hash, isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Render diff with syntax highlighting
  const renderDiff = (diff: string) => {
    return diff.split("\n").map((line, index) => {
      let className = "text-[#e6edf3]";
      if (line.startsWith("+")) {
        className = "text-[#3fb950]";
      } else if (line.startsWith("-")) {
        className = "text-[#f85149]";
      } else if (line.startsWith("@@")) {
        className = "text-[#8b949e]";
      }

      return (
        <div key={index} className={className}>
          {line || "\u00A0"}
        </div>
      );
    });
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            提交详情
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366f1] mb-4"></div>
                <p className="text-sm text-[#8b949e]">Loading...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-red-500 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Loading failed</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
              </div>
            </div>
          )}

          {/* Commit data */}
          {commitData && !isLoading && !error && (
            <div className="space-y-4">
              {/* Commit metadata */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">提交哈希</h3>
                  <code className="text-xs font-mono text-[#58a6ff] bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                    {commitData.hash}
                  </code>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">提交信息</h3>
                  <p className="text-sm text-gray-900 dark:text-white">{commitData.message}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">作者</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{commitData.author}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">日期</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{commitData.date}</p>
                  </div>
                </div>
              </div>

              {/* Diff */}
              {commitData.diff && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">变更内容</h3>
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 overflow-x-auto">
                    <pre className="text-xs font-mono">
                      <code>{renderDiff(commitData.diff)}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* No diff available */}
              {!commitData.diff && (
                <div className="flex items-start gap-2 text-sm text-[#8b949e]">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>此提交没有可用的 diff 内容</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-[#30363d]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e0] text-white text-sm rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
