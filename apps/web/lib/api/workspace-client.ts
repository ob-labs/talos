/**
 * Client-side API for workspace and worktree data.
 * Use these instead of direct storage imports in client components.
 */
import type { Workspace, Worktree, TerminalLog } from '@talos/types';

export interface WorkspacesResponse {
  workspaces: Workspace[];
  worktrees: Worktree[];
}

export async function fetchWorkspacesAndWorktrees(): Promise<WorkspacesResponse> {
  const res = await fetch("/api/workspaces");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch workspaces: ${res.status}`);
  }
  return res.json();
}

export async function fetchWorktree(worktreeId: string): Promise<Worktree | null> {
  const res = await fetch(`/api/worktrees/${worktreeId}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to fetch worktree: ${res.status}`);
  }
  return res.json();
}

export async function addTerminalLog(
  worktreeId: string,
  type: TerminalLog["type"],
  message: string
): Promise<Worktree> {
  const res = await fetch(`/api/worktrees/${worktreeId}/terminal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to add terminal log: ${res.status}`);
  }
  return res.json();
}

export async function toggleStoryCompletion(
  worktreeId: string,
  storyId: string
): Promise<Worktree> {
  const res = await fetch(`/api/worktrees/${worktreeId}/stories/${storyId}/toggle`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to toggle story: ${res.status}`);
  }
  return res.json();
}

export async function updateStoryStatus(
  worktreeId: string,
  storyId: string,
  status: "running" | "skipped" | "completed" | "failed" | "pending"
): Promise<Worktree> {
  const res = await fetch(`/api/worktrees/${worktreeId}/stories/${storyId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update story status: ${res.status}`);
  }
  return res.json();
}
