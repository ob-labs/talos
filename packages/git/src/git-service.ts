import { exec } from "child_process";
import { promisify } from "util";
import { GitError } from "@talos/types";

const execAsync = promisify(exec);

/**
 * Worktree information from listWorktrees
 */
export interface WorktreeListItem {
  path: string;
  commit: string;
  branch?: string;
  isBare: boolean;
  isDetached: boolean;
}

/**
 * GitService for worktree operations
 * Uses child_process.exec for git command execution
 */
export class GitService {
  /**
   * Create a new worktree
   * Executes: git worktree add <path> -b <branch>
   */
  async createWorktree(
    repository: string,
    branch: string,
    path: string
  ): Promise<void> {
    try {
      const command = `cd "${repository}" && git worktree add "${path}" -b "${branch}"`;
      await execAsync(command);
    } catch (error) {
      throw new GitError(
        `Failed to create worktree at ${path} for branch ${branch}`,
        error as Error
      );
    }
  }

  /**
   * Delete a worktree
   * Executes: git worktree remove <path>
   */
  async deleteWorktree(path: string): Promise<void> {
    try {
      const command = `git worktree remove "${path}"`;
      await execAsync(command);
    } catch (error) {
      throw new GitError(
        `Failed to delete worktree at ${path}`,
        error as Error
      );
    }
  }

  /**
   * List all worktrees in a repository
   * Executes: git worktree list --porcelain
   */
  async listWorktrees(repository: string): Promise<WorktreeListItem[]> {
    try {
      const command = `cd "${repository}" && git worktree list --porcelain`;
      const { stdout } = await execAsync(command);

      // Parse porcelain output
      const lines = stdout.split("\n");
      const result: WorktreeListItem[] = [];
      let current: Partial<WorktreeListItem> = {};

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          if (current.path) {
            result.push(current as WorktreeListItem);
          }
          current = { path: line.substring(9).trim() };
        } else if (line.startsWith("HEAD ")) {
          current.commit = line.substring(5).trim();
        } else if (line.startsWith("branch ")) {
          const branchRef = line.substring(7).trim();
          current.branch = branchRef.replace("refs/heads/", "");
        } else if (line === "bare") {
          current.isBare = true;
        } else if (line === "detached") {
          current.isDetached = true;
        }
      }

      // Push the last one
      if (current.path) {
        result.push(current as WorktreeListItem);
      }

      // Set defaults for undefined properties
      return result.map((wt) => ({
        ...wt,
        isBare: wt.isBare ?? false,
        isDetached: wt.isDetached ?? false,
      }));
    } catch (error) {
      throw new GitError(
        `Failed to list worktrees in ${repository}`,
        error as Error
      );
    }
  }

  /**
   * Get worktree information
   * Reads .git/worktrees/<worktreeName>/gitdir or HEAD
   */
  async getWorktreeInfo(
    workspacePath: string,
    worktreeName: string
  ): Promise<WorktreeListItem | null> {
    try {
      const worktrees = await this.listWorktrees(workspacePath);
      return (
        worktrees.find((wt) => wt.path.includes(worktreeName)) || null
      );
    } catch (error) {
      // Return null if info not found
      return null;
    }
  }

  /**
   * Get story information from worktree
   * Parses branch name or git log for story metadata
   */
  async getStoryInfo(
    workspacePath: string,
    storyId: string
  ): Promise<{ id: string; title: string; status: string } | null> {
    try {
      // Try to find the worktree by story ID
      const worktrees = await this.listWorktrees(workspacePath);
      const worktree = worktrees.find((wt) => wt.path.includes(storyId));

      if (!worktree || !worktree.branch) {
        return null;
      }

      // Extract story info from branch name
      // Assuming branch naming convention: worktree/story-id-title or similar
      const branchParts = worktree.branch.split("/");
      const id = storyId;
      const title = branchParts[branchParts.length - 1] || worktree.branch;
      const status = "in_progress"; // Default status

      return { id, title, status };
    } catch (error) {
      // Return null if info not found
      return null;
    }
  }
}
