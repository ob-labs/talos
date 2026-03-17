import { workspaceSessionStorage } from '@talos/core';
import type { Workspace } from "@/types";
import {
  handleValidationError,
  handleNotFoundError,
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";
import { NextRequest } from "next/server";

/**
 * GET /api/workspaces/[id]
 * Get a single workspace by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const { id: workspaceId } = await params;

    if (!workspaceId) {
      return handleValidationError("Workspace ID is required", { field: "id" });
    }

    const workspaceConfig = await workspaceSessionStorage.getWorkspace(workspaceId);

    if (!workspaceConfig) {
      return handleNotFoundError("Workspace", workspaceId);
    }

    // Convert WorkspaceConfig to Workspace for API response
    const workspace: Workspace = {
      id: workspaceConfig.id,
      name: workspaceConfig.name,
      branch: "main", // Default branch
      path: workspaceConfig.path,
      worktrees: [],
      terminals: [],
      expanded: true,
    };

    return handleSuccess({ workspace });
  }, "GET /api/workspaces/[id]");
}
