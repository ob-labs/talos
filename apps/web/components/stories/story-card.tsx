import { memo } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { ExecutionState, ExecutionStatus } from "@/types";

interface StoryCardProps {
  story: ExecutionState;
  onClick: () => void;
  onLogClick: () => void;
  onDetailClick: () => void;
}

function getStatusInfo(
  status: ExecutionStatus
): {
  label: string;
  variant: "gray" | "blue" | "green" | "yellow" | "red";
} {
  switch (status) {
    case "pending":
      return { label: "Pending", variant: "gray" };
    case "running":
      return { label: "Running", variant: "blue" };
    case "paused":
      return { label: "Paused", variant: "yellow" };
    case "completed":
      return { label: "Completed", variant: "green" };
    case "failed":
      return { label: "Failed", variant: "red" };
    case "cancelled":
      return { label: "Cancelled", variant: "red" };
  }
}

function isStoryRunning(status: ExecutionStatus): boolean {
  return status === "running" || status === "pending";
}

function isStoryCompleted(status: ExecutionStatus): boolean {
  return status === "completed";
}

function isStoryFailed(status: ExecutionStatus): boolean {
  return status === "failed" || status === "cancelled";
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}hours${minutes % 60}minutes`;
  } else if (minutes > 0) {
    return `${minutes}minutes${seconds % 60}seconds`;
  } else {
    return `${seconds}seconds`;
  }
}

/**
 * StoryCard component - displays a single story with memoization for performance
 *
 * Memoized to prevent unnecessary re-renders when parent state changes.
 * Only re-renders when the story object changes (by ID reference).
 */
export const StoryCard = memo(function StoryCard({
  story,
  onClick,
  onLogClick,
  onDetailClick,
}: StoryCardProps) {
  const statusInfo = getStatusInfo(story.status);
  const isRunning = isStoryRunning(story.status);
  const isCompleted = isStoryCompleted(story.status);
  const isFailed = isStoryFailed(story.status);

  // Calculate duration for display
  const duration = story.completedAt
    ? story.completedAt - story.startedAt
    : Date.now() - story.startedAt;

  return (
    <Card
      className={`p-6 transition-all cursor-pointer hover:shadow-md ${
        isRunning ? "border-2 border-blue-500 dark:border-blue-400" : ""
      }`}
      onClick={onClick}
    >
      <div className="space-y-4">
        {/* Story Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {/* Status Icon */}
              {isCompleted && (
                <span className="text-green-600 dark:text-green-400 text-xl">
                  ✓
                </span>
              )}
              {isFailed && (
                <span className="text-red-600 dark:text-red-400 text-xl">
                  ✗
                </span>
              )}
              {isRunning && (
                <span className="text-blue-600 dark:text-blue-400 text-xl animate-pulse">
                  ▶
                </span>
              )}

              {/* Story ID */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {story.id}
              </h3>

              {/* Status Badge */}
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>

            {/* Timestamps */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Start:{formatTimestamp(story.startedAt)}
              {story.completedAt && (
                <span>
                  {" • "}
                  End:{formatTimestamp(story.completedAt)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Progress */}
        {story.totalStories > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>
                Progress:{story.completedStories}/{story.totalStories} stories
              </span>
              <span>{story.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isCompleted
                    ? "bg-green-600 dark:bg-green-400"
                    : isFailed
                      ? "bg-red-600 dark:bg-red-400"
                      : "bg-blue-600 dark:bg-blue-400"
                }`}
                style={{ width: `${story.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Current Story */}
        {story.currentStoryTitle && (
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">Current story:</span>
            {story.currentStoryTitle}
          </div>
        )}

        {/* Duration */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {story.completedAt ? (
            <span>Duration:{formatDuration(duration)}</span>
          ) : (
            <span>Running:{formatDuration(duration)}</span>
          )}
        </div>

        {/* Error Message */}
        {story.error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-800 dark:text-red-200">
              <span className="font-medium">Error:</span>
              {story.error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            className="text-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDetailClick();
            }}
          >
            View Details
          </Button>
          <Button
            variant="ghost"
            className="text-sm"
            onClick={(e) => {
              e.stopPropagation();
              onLogClick();
            }}
          >
            View Logs
          </Button>
        </div>
      </div>
    </Card>
  );
});
