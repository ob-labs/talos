"use client";

import { useEffect, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { StoryConversation } from "./story-conversation";
import { CommitDiffViewer } from "./commit-diff-viewer";
import type { StoryDetails } from "@/types";

export interface StoryDetailsPanelProps {
  storyId: string;
  prdId: string;
}

/**
 * StoryDetailsPanel component for displaying detailed story information
 *
 * Fetches and displays story details including:
 * - PRD data (id, title, description, acceptance criteria, priority, dependencies, completion status, notes)
 * - Optional execution history for completed stories (progress entry and task conversation)
 *
 * Features:
 * - Loading state while fetching data
 * - Error handling for failed requests
 * - Conditional rendering based on story completion status
 * - Maps worktree ID to actual PRD ID before fetching data
 */
export function StoryDetailsPanel({ storyId, prdId: worktreeId }: StoryDetailsPanelProps) {
  const [actualPrdId, setActualPrdId] = useState<string | null>(null);
  const [story, setStory] = useState<StoryDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<string[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(true);
  const [commitsError, setCommitsError] = useState<string | null>(null);
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [isDiffViewerOpen, setIsDiffViewerOpen] = useState(false);

  // Step 1: Map worktreeId to actual PRD ID
  useEffect(() => {
    const fetchPrdId = async () => {
      try {
        const response = await fetch(`/api/worktrees/${encodeURIComponent(worktreeId)}/prd`);
        if (!response.ok) {
          throw new Error(`Failed to get PRD ID: ${response.status}`);
        }
        const data = await response.json();
        setActualPrdId(data.prdId);
      } catch (err) {
        console.error("Failed to fetch PRD ID:", err);
        setError((err as Error).message || "Failed to get PRD ID");
      }
    };

    fetchPrdId();
  }, [worktreeId]);

  // Step 2: Fetch story details when we have the actual PRD ID
  useEffect(() => {
    if (!actualPrdId) {
      // Wait for PRD ID to be resolved
      return;
    }

    const fetchStoryDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use actual PRD ID to fetch story details
        const response = await fetch(`/api/worktrees/${encodeURIComponent(worktreeId)}/stories/${storyId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch story: ${response.status}`);
        }

        const data: StoryDetails = await response.json();
        setStory(data);
      } catch (err) {
        console.error("Failed to fetch story details:", err);
        setError((err as Error).message || "Failed to load story details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStoryDetails();
  }, [storyId, actualPrdId, worktreeId]);

  // Fetch commits for the story
  useEffect(() => {
    if (!actualPrdId) {
      setCommitsLoading(false);
      return;
    }

    const fetchCommits = async () => {
      setCommitsLoading(true);
      setCommitsError(null);

      try {
        // Use actual PRD ID to fetch commits
        const response = await fetch(`/api/prds/${encodeURIComponent(actualPrdId)}/stories/${storyId}/commits`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch commits: ${response.status}`);
        }

        const data = await response.json() as { commits: string[] };
        setCommits(data.commits);
      } catch (err) {
        console.error("Failed to fetch commits:", err);
        setCommitsError((err as Error).message || "Failed to load commit history");
      } finally {
        setCommitsLoading(false);
      }
    };

    fetchCommits();
  }, [storyId, actualPrdId]);

  if (isLoading) {
    return (
      <Card className="m-4 p-6 bg-gray-800/50">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-[#8b949e]">Loading...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="m-4 p-6 bg-gray-800/50">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-red-400">Loading failed:{error}</div>
        </div>
      </Card>
    );
  }

  if (!story) {
    return (
      <Card className="m-4 p-6 bg-gray-800/50">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-[#8b949e]">Story not found</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="m-4 flex flex-col h-full overflow-hidden bg-gray-800/50">
      {/* Header Section */}
      <div className="border-b border-[#30363d] px-6 py-4 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={story.passes ? "green" : "gray"}>
              {story.id}
            </Badge>
            {story.priority && (
              <Badge variant="blue" className="text-xs">
                Priority: {story.priority}
              </Badge>
            )}
          </div>
          <h2 className="text-lg font-semibold text-[#e6edf3] truncate">{story.title}</h2>
        </div>
        {!isDiffViewerOpen && (
          <button
            onClick={() => setIsDiffViewerOpen(true)}
            className="text-xs text-[#58a6ff] hover:text-[#79c0ff] transition-colors"
          >
            View commit history ({commits.length})
          </button>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {/* Description */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-[#8b949e] mb-2">Description</h3>
          <p className="text-sm text-[#c9d1d9] leading-relaxed">{story.description}</p>
        </div>

        {/* Acceptance Criteria */}
        {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#8b949e] mb-2">Acceptance Criteria</h3>
            <ul className="space-y-1">
              {story.acceptanceCriteria.map((criteria, index) => (
                <li key={index} className="text-sm text-[#c9d1d9] flex gap-2">
                  <span className="text-[#8b949e]">•</span>
                  <span>{criteria}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {story.notes && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#8b949e] mb-2">Notes</h3>
            <p className="text-sm text-[#c9d1d9] whitespace-pre-wrap">{story.notes}</p>
          </div>
        )}

        {/* Execution History (if story is completed) */}
        {story.passes && story.progressEntry && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#8b949e] mb-2">Execution History</h3>
            <div className="bg-[#161b22] rounded p-3 text-xs text-[#c9d1d9] space-y-3">
              {story.progressEntry.implemented && story.progressEntry.implemented.length > 0 && (
                <div>
                  <h4 className="font-medium text-[#e6edf3] mb-1">Implementation</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {story.progressEntry.implemented.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {story.progressEntry.filesChanged && story.progressEntry.filesChanged.length > 0 && (
                <div>
                  <h4 className="font-medium text-[#e6edf3] mb-1">Changed Files</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {story.progressEntry.filesChanged.map((file, idx) => (
                      <li key={idx} className="font-mono">{file}</li>
                    ))}
                  </ul>
                </div>
              )}
              {story.progressEntry.learnings && story.progressEntry.learnings.length > 0 && (
                <div>
                  <h4 className="font-medium text-[#e6edf3] mb-1">Learnings</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {story.progressEntry.learnings.map((learning, idx) => (
                      <li key={idx}>{learning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {story.progressEntry.manualVerification !== undefined && (
                <div>
                  <h4 className="font-medium text-[#e6edf3] mb-1">Verification Method</h4>
                  <p>{story.progressEntry.manualVerification ? '✅ Manually Verified' : '⏳ Pending Verification'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task Conversation (if story is completed) */}
        {/* Note: Task conversation data is not currently available from the worktree API endpoint */}

        {/* Note: Commit diff viewer requires different API integration - currently disabled */}
        {/* {isDiffViewerOpen && (
          <CommitDiffViewer
            commits={commits}
            isLoading={commitsLoading}
            error={commitsError}
            selectedCommitHash={selectedCommitHash}
            onSelectCommit={setSelectedCommitHash}
            onClose={() => setIsDiffViewerOpen(false)}
          />
        )} */}
      </div>
    </Card>
  );
}
