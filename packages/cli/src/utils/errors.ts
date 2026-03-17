/**
 * CLI Error Message Constants
 */

export const ErrorMessages = {
  // Project root errors
  PROJECT_ROOT_NOT_FOUND: `Error: Talos project root directory not found

Please ensure you are running this command in a Talos project directory.

Search indicators:
  - turbo.json file
  - apps/web/ directory

Suggestion:
  - Run this command in the project root directory
  - If running from a subdirectory, CLI will automatically search upward for the project root`,

  // Ralph script errors
  PRD_NOT_FOUND: (path: string) => `Error: PRD file not found

PRD path: ${path}

Ralph requires prd.json to execute.

Suggestion:
  - Ensure ralph/<name>/prd.json exists
  - Run 'talos ralph' to convert and generate from PRD in tasks/
  - Run 'talos prd' to create a new PRD`,

  // Execution errors
  RALPH_EXECUTION_FAILED: (exitCode: number) => `Error: Ralph script execution failed

Exit code: ${exitCode}

Please check the error information in the output and retry after fixing the issue.

Suggestion:
  - View ralph/<name>/progress.txt for execution progress
  - Check user story configuration in ralph/<name>/prd.json
  - Ensure all dependencies are installed (run 'pnpm install')`,

  // File permissions
  SCRIPT_NOT_EXECUTABLE: (path: string) => `Error: Script has no execute permission

Script path: ${path}

Suggestion:
  - Run the following command to add execute permission:
    chmod +x ${path}`,

  // Worktree errors
  WORKTREE_CREATE_FAILED: (path: string, branch: string, reason?: string) => `Error: Failed to create Git worktree

Worktree path: ${path}
Target branch: ${branch}
${reason ? `Failure reason: ${reason}` : ''}

Suggestion:
  - Check if branch name is correct
  - Ensure sufficient disk space
  - Manually clean up invalid worktree: git worktree prune
  - Check path permissions: ls -la ${path}
  - Try manual creation: git worktree add ${path} ${branch}`,

  WORKTREE_CLEANUP_FAILED: (path: string, reason?: string) => `Error: Failed to clean up Git worktree

Worktree path: ${path}
${reason ? `Failure reason: ${reason}` : ''}

Suggestion:
  - Manually clean up Git metadata: git worktree prune
  - Check worktree directory permissions: ls -la ${path}
  - Ensure no other process is using the worktree
  - Try manual deletion: rm -rf ${path}`,

  WORKTREE_NOT_FOUND: (path: string) => `Error: Git worktree not found

Worktree path: ${path}

Suggestion:
  - Run 'git worktree list' to view all worktrees
  - Confirm if worktree path is correct
  - If worktree was deleted, run 'git worktree prune' to clean up
  - Recreate worktree: talos run`,

  WORKTREE_IN_USE: (path: string, conflictingBranch: string) => `Error: Worktree already in use

Worktree path: ${path}
Conflicting branch: ${conflictingBranch}

This worktree is already associated with another branch and cannot be used directly.

Suggestion:
  - If using a new branch, delete existing worktree: git worktree remove ${path}
  - After deletion, run 'git worktree prune' to clean up metadata
  - Then re-execute: talos run
  - Or switch to existing branch: git switch ${conflictingBranch}`,

  GIT_VERSION_TOO_OLD: (currentVersion: string) => `Error: Git version too old

Current version: ${currentVersion}
Required version: Git 2.5 or higher

Git worktree functionality requires Git 2.5+ to work properly.

Suggestion:
  - Upgrade Git to latest version:
    - macOS: brew install git
    - Ubuntu: sudo apt-get install git
    - Windows: https://git-scm.com/download/win
  - Verify upgrade: git --version
  - If issues persist after upgrade, restart terminal`,

  // Generic error
  UNKNOWN_ERROR: (error: unknown) => `Error: Unknown error occurred

${error instanceof Error ? error.message : String(error)}

Suggestion:
  - Check detailed information in error message
  - If problem persists, check log file`,
} as const;
