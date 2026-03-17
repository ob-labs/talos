import { NextRequest } from "next/server";
import { TerminalCommandHandler } from "@talos/terminal";
import { workspaceStorage } from '@talos/core';
import { withErrorHandler, handleSuccess, handleValidationError } from "@/lib/api/error-handler";

/**
 * POST /api/terminal/shell
 *
 * Execute shell-like commands (help, ls, cd, cat, etc.) on the server.
 * Required because TerminalCommandHandler uses Node.js fs which is not available in the browser.
 *
 * Request body:
 * - command: string - The command to execute (e.g., "help", "ls", "pwd")
 * - cwd?: string - Working directory (defaults to workspace path or process.cwd())
 * - workspaceId?: string
 * - worktreeId?: string
 * - taskId?: string
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { command, cwd, workspaceId, worktreeId, taskId } = body;

    if (!command || typeof command !== "string") {
      return handleValidationError("command is required", { field: "command" });
    }

    // Resolve cwd: use workspace path if workspaceId provided, else use cwd or process.cwd()
    let resolvedCwd = cwd || process.cwd();
    if (workspaceId) {
      const workspace = await workspaceStorage.getWorkspace(workspaceId);
      if (workspace?.path) {
        resolvedCwd = workspace.path;
      }
    }

    const context = {
      cwd: resolvedCwd,
      workspaceId,
      worktreeId,
      taskId,
    };

    const handler = new TerminalCommandHandler();
    const result = await handler.execute(command, context);

    return handleSuccess(result);
  }, "POST /api/terminal/shell");
}
