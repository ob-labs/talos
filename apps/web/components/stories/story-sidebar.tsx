"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { ChatMessage } from "@/components/chat";
import type { ExecutionState, PRD } from "@/types";

interface StorySidebarProps {
  story: ExecutionState | null;
  onClose: () => void;
  isOpen: boolean;
}

interface StoryMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function StorySidebar({ story, onClose, isOpen }: StorySidebarProps) {
  const [messages, setMessages] = useState<StoryMessage[]>([]);
  const [prd, setPrd] = useState<PRD | null>(null);
  const [loadingPrd, setLoadingPrd] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch PRD details when task changes
  useEffect(() => {
    if (!story) {
      setPrd(null);
      return;
    }

    setLoadingPrd(true);
    fetch(`/api/prds/${story.prdId}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to fetch PRD");
      })
      .then((data) => {
        setPrd(data);
        setLoadingPrd(false);
      })
      .catch((err) => {
        console.error("Failed to fetch PRD:", err);
        setLoadingPrd(false);
      });
  }, [story]);

  // SSE streaming is disabled in read-only mode
  // Use CLI to view execution logs
  useEffect(() => {
    if (!story || !isOpen) return;

    // No SSE connection - Web interface is read-only
    // Use CLI or check execution history for logs
    eventSourceRef.current = null;

    return () => {
      // Cleanup
    };
  }, [story, isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Clear messages when task changes
  useEffect(() => {
    if (story) {
      setMessages([]);
    }
  }, [story?.prdId]);

  const currentStory = useMemo(() => {
    if (!story || !story.currentStoryId || !prd) return null;
    return prd.userStories?.find((s: { id: string }) => s.id === story.currentStoryId);
  }, [story, prd]);

  function formatTimestamp(timestamp: number): string {
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

  function getStatusVariant(status: string): "gray" | "blue" | "green" | "yellow" | "red" {
    switch (status) {
      case "pending":
        return "gray";
      case "running":
        return "blue";
      case "paused":
        return "yellow";
      case "completed":
        return "green";
      case "failed":
      case "cancelled":
        return "red";
      default:
        return "gray";
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case "pending":
        return "Pending";
      case "running":
        return "Running";
      case "paused":
        return "Paused";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  }

  if (!story) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full bg-white dark:bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } w-full md:w-[400px] flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            Story Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close sidebar"
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Story ID and Status */}
          <Card>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Story ID</span>
                <Badge variant={getStatusVariant(story.status)}>
                  {getStatusLabel(story.status)}
                </Badge>
              </div>
              <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                {story.id}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Start Time</span>
                <span className="text-gray-900 dark:text-white">
                  {formatTimestamp(story.startedAt)}
                </span>
              </div>
              {story.completedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">End Time</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatTimestamp(story.completedAt)}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Progress */}
          {story.totalStories > 0 && (
            <Card>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Progress</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {story.completedStories}/{story.totalStories} stories
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      story.status === "completed"
                        ? "bg-green-600 dark:bg-green-400"
                        : story.status === "failed"
                          ? "bg-red-600 dark:bg-red-400"
                          : "bg-blue-600 dark:bg-blue-400"
                    }`}
                    style={{ width: `${story.progress}%` }}
                  />
                </div>
                <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                  {story.progress}%
                </div>
              </div>
            </Card>
          )}

          {/* Current Story */}
          {currentStory && (
            <Card>
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Story
                  </h3>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {currentStory.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {currentStory.id}
                  </p>
                </div>
                {currentStory.description && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {currentStory.description}
                    </p>
                  </div>
                )}
                {currentStory.acceptanceCriteria && currentStory.acceptanceCriteria.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Acceptance Criteria
                    </h4>
                    <ul className="space-y-1">
                      {currentStory.acceptanceCriteria.map((criteria: string, index: number) => (
                        <li
                          key={index}
                          className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2"
                        >
                          <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
                          <span>{criteria}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Error Message */}
          {story.error && (
            <Card className="border-red-200 dark:border-red-800">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <p className="text-sm text-red-700 dark:text-red-300">{story.error}</p>
              </div>
            </Card>
          )}

          {/* Conversation Log */}
          <Card>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Conversation History ({messages.length} message(s))
              </h3>
              <div className="max-h-[400px] overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-4">
                    No conversation records
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message, index) => (
                      <ChatMessage
                        key={`${message.timestamp}-${message.role}-${index}`}
                        role={message.role}
                        content={message.content}
                        timestamp={message.timestamp}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Story Results */}
          {story.storyResults.length > 0 && (
            <Card>
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Story Execution Records
                </h3>
                <div className="space-y-2">
                  {story.storyResults.map((result) => (
                    <div
                      key={result.storyId}
                      className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {result.storyTitle}
                        </span>
                        <Badge variant={result.success ? "green" : "red"} className="text-xs">
                          {result.success ? "Success" : "Failed"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                        <span>{result.storyId}</span>
                        <span>attempts {result.attempts}times</span>
                        <span>{(result.duration / 1000).toFixed(1)}s</span>
                      </div>
                      {result.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                          {result.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <a
            href={`/stories/${story.id}/log`}
            className="block w-full"
            onClick={onClose}
          >
            <Button variant="ghost" className="w-full">
              View Full Logs
            </Button>
          </a>
        </div>
      </div>
    </>
  );
}
