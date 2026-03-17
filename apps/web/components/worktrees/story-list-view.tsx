"use client";

import { useState, useEffect } from "react";
import type { Worktree } from "@/types";
import { fetchWorktree, toggleStoryCompletion } from "@/lib/api/workspace-client";

interface StoryListViewProps {
  worktreeId: string | null;
  activeStory: string | null;
  onStoryClick: (storyId: string) => void;
  onClose?: () => void; // Optional callback for closing (e.g., drawer)
}

export function StoryListView({ worktreeId, activeStory, onStoryClick, onClose }: StoryListViewProps) {
  const [worktree, setWorktree] = useState<Worktree | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load worktree data when worktreeId changes
  useEffect(() => {
    const loadWorktree = async () => {
      if (!worktreeId) {
        setWorktree(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const worktreeData = await fetchWorktree(worktreeId);
        setWorktree(worktreeData ?? null);
      } catch (error) {
        console.error("Failed to load worktree:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorktree();
  }, [worktreeId]);

  // Handle checkbox click to toggle story completion
  const handleToggleStory = async (e: React.MouseEvent, storyId: string) => {
    e.stopPropagation();
    if (!worktreeId) return;

    try {
      const updatedWorktree = await toggleStoryCompletion(worktreeId, storyId);
      setWorktree(updatedWorktree);
    } catch (error) {
      console.error("Failed to toggle story:", error);
    }
  };

  // Handle story click
  const handleStoryClick = (storyId: string) => {
    onStoryClick(storyId);
    // Close drawer or panel if onClose callback is provided
    if (onClose) {
      onClose();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-[#8b949e]">加载中...</div>
      </div>
    );
  }

  if (!worktree) {
    return (
      <div className="text-sm text-[#8b949e] py-8 text-center">
        {worktreeId ? "未找到功能信息" : "请选择一个功能模块"}
      </div>
    );
  }

  if (worktree.stories.length === 0) {
    return (
      <div className="text-sm text-[#8b949e] py-8 text-center">
        暂无故事
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Worktree info header */}
      <div className="mb-4 pb-3 border-b border-[#30363d]">
        <div className="text-sm font-medium text-[#e6edf3]">{worktree.title}</div>
        <div className="text-xs text-[#8b949e] mt-1">{worktree.stories.length} 个故事</div>
      </div>

      {/* Story list */}
      {worktree.stories.map((story) => (
        <div
          key={story.id}
          className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-md active:scale-[0.98] ${
            activeStory === story.id
              ? "bg-gradient-to-r from-[#6366f1]/20 to-[#6366f1]/10 border border-[#6366f1] shadow-[0_0_12px_rgba(99,102,241,0.2)]"
              : "bg-[#1e1e1e] hover:bg-[#2d2d2d] border border-transparent hover:border-[#3c3c3c]"
          }`}
          onClick={() => handleStoryClick(story.id)}
        >
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              checked={story.passes}
              onChange={() => {}}
              onClick={(e) => handleToggleStory(e, story.id)}
              className="mt-1 w-4 h-4 rounded border-[#30363d] bg-[#1e1e1e] text-[#6366f1] focus:ring-[#6366f1] cursor-pointer transition-all duration-150 checked:bg-gradient-to-br checked:from-[#6366f1] checked:to-[#58a6ff]"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-xs font-mono text-[#8b949e]">{story.id}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  story.passes ? "bg-[#6366f1]/20 text-[#6366f1]" : "bg-[#30363d] text-[#8b949e]"
                }`}>
                  {story.passes ? "已完成" : "待开始"}
                </span>
                {story.commit && (
                  <span className="text-xs font-mono text-[#58a6ff]" title={story.commit.message}>
                    {story.commit.hash.slice(0, 7)}
                  </span>
                )}
              </div>
              <div className="text-sm text-[#e6edf3] mt-1">{story.title}</div>
              {story.description && (
                <div className="text-xs text-[#8b949e] mt-1 line-clamp-2">{story.description}</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
