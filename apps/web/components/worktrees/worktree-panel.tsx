'use client';

/**
 * WorktreePanel 组件
 * WorktreePanel Component
 *
 * 显示所有 workspace 的 worktree 列表和状态
 * Displays all workspace worktrees and their status
 *
 * 使用 react-query 的 useQuery 实现轮询（每 10 秒刷新一次）
 * Uses react-query's useQuery for polling (refreshes every 10 seconds)
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Card } from '@/components/ui';
import type { WorkspaceWorktrees, WorktreeStatus, WorktreeUserStory } from '@talos/types';

/**
 * 获取 worktree 数据的函数
 * Fetch function for worktree data
 */
async function fetchWorktrees(): Promise<WorkspaceWorktrees[]> {
  const response = await fetch('/api/workspaces/worktrees');
  if (!response.ok) {
    throw new Error('Failed to fetch worktrees');
  }
  const data = await response.json();
  return data.workspaces;
}

/**
 * 格式化最后更新时间
 * Format last update timestamp
 */
function formatLastUpdate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * WorktreeItem 组件 - 显示单个 worktree
 * WorktreeItem component - displays a single worktree
 */
function WorktreeItem({ worktree }: { worktree: WorktreeStatus }) {
  const [isExpanded, setIsExpanded] = useState(true);

  // 根据完成状态确定徽章颜色
  // Determine badge color based on completion status
  const statusVariant = worktree.isComplete
    ? 'green'
    : worktree.completedCount > 0
      ? 'blue'
      : 'gray';

  const statusLabel = worktree.isComplete
    ? '已完成'
    : worktree.completedCount > 0
      ? '进行中'
      : '待开始';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
      {/* Worktree Header - 可点击展开/折叠 */}
      <div
        className="p-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* 展开/折叠图标 */}
            <span className="text-gray-500 dark:text-gray-400">
              {isExpanded ? '▼' : '▶'}
            </span>

            {/* 分支名 */}
            <span className="font-medium text-gray-900 dark:text-white">
              {worktree.branch}
            </span>

            {/* 状态徽章 */}
            <Badge variant={statusVariant}>{statusLabel}</Badge>

            {/* 进度 */}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {worktree.completedCount}/{worktree.totalCount} ({Math.round(worktree.progress)}%)
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              worktree.isComplete
                ? 'bg-green-600 dark:bg-green-400'
                : worktree.completedCount > 0
                  ? 'bg-blue-600 dark:bg-blue-400'
                  : 'bg-gray-400 dark:bg-gray-500'
            }`}
            style={{ width: `${worktree.progress}%` }}
          />
        </div>
      </div>

      {/* Worktree Details - 用户故事列表 */}
      {isExpanded && (
        <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          {worktree.userStories.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              暂无用户故事
            </p>
          ) : (
            <div className="space-y-2">
              {worktree.userStories.map((story) => (
                <UserStoryItem key={story.id} story={story} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * UserStoryItem 组件 - 显示单个用户故事
 * UserStoryItem component - displays a single user story
 */
function UserStoryItem({ story }: { story: WorktreeUserStory }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {/* 完成状态 */}
      <span className="mt-0.5">
        {story.passes ? (
          <span className="text-green-600 dark:text-green-400">✓</span>
        ) : (
          <span className="text-gray-400 dark:text-gray-600">✗</span>
        )}
      </span>

      {/* 故事标题 */}
      <div className="flex-1">
        <span
          className={`${
            story.passes
              ? 'text-gray-700 dark:text-gray-300 line-through'
              : 'text-gray-900 dark:text-white'
          }`}
        >
          {story.title}
        </span>

        {/* 备注（如果有） */}
        {story.notes && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            备注：{story.notes}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * WorkspaceSection 组件 - 显示单个 workspace 及其 worktrees
 * WorkspaceSection component - displays a single workspace and its worktrees
 */
function WorkspaceSection({ workspace }: { workspace: WorkspaceWorktrees }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mb-4">
      {/* Workspace Header */}
      <div
        className="p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-t-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500 dark:text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {workspace.name}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            ({workspace.path})
          </span>
          <Badge variant="gray" className="ml-auto">
            {workspace.worktrees.length} 个 worktree
          </Badge>
        </div>
      </div>

      {/* Worktrees List */}
      {isExpanded && (
        <div className="p-2 bg-white dark:bg-gray-900 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-md space-y-2">
          {workspace.worktrees.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic p-2">
              暂无 worktree
            </p>
          ) : (
            workspace.worktrees.map((worktree) => (
              <WorktreeItem key={worktree.path} worktree={worktree} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * WorktreePanel 组件 - 主组件
 * WorktreePanel component - main component
 */
export function WorktreePanel() {
  const {
    data: workspaces,
    isLoading,
    error,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['workspaces', 'worktrees'],
    queryFn: fetchWorktrees,
    refetchInterval: 10000, // 每 10 秒轮询一次 / Poll every 10 seconds
  });

  // 加载状态
  // Loading state
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
          <span className="animate-pulse">加载中...</span>
        </div>
      </Card>
    );
  }

  // 错误状态
  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="text-red-600 dark:text-red-400">
          <p className="font-medium">加载失败</p>
          <p className="text-sm mt-1">{(error as Error).message}</p>
        </div>
      </Card>
    );
  }

  // 空状态
  // Empty state
  if (!workspaces || workspaces.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          暂无 workspace
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* 标题和最后更新时间 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Worktree 状态
        </h2>
        {dataUpdatedAt && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            最后更新：{formatLastUpdate(dataUpdatedAt)}
          </span>
        )}
      </div>

      {/* Workspace 列表 */}
      <div>
        {workspaces.map((workspace) => (
          <WorkspaceSection key={workspace.id} workspace={workspace} />
        ))}
      </div>
    </Card>
  );
}
