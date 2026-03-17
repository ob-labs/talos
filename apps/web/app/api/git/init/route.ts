import { GitRepository } from "@talos/git";
import {
  handleAPIError,
  handleValidationError,
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";
import { NextRequest } from "next/server";

/**
 * POST /api/git/init
 * Initialize a git repository at the specified path
 *
 * Request body:
 * {
 *   "path": string  // Path to the directory to initialize
 * }
 *
 * Response:
 * {
 *   "success": boolean,
 *   "message": string,
 *   "isRepo": boolean  // Whether it was already a repo
 * }
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { path } = body;

    if (!path || typeof path !== "string") {
      return handleValidationError("Path is required and must be a string", { field: "path" });
    }

    const git = new GitRepository(path);

    // Check if already a git repository
    const isRepoResult = await git.isRepo();
    if (!isRepoResult.success) {
      return handleAPIError(new Error(isRepoResult.error || "Git error"), "POST /api/git/init");
    }

    // If already a repo, return success with info
    if (isRepoResult.data) {
      return handleSuccess({
        success: true,
        message: "Directory is already a git repository",
        isRepo: true,
        path,
      });
    }

    // Initialize git repository
    const initResult = await git.init(false);

    if (!initResult.success) {
      return handleAPIError(new Error(initResult.error || "Git init failed"), "POST /api/git/init");
    }

    return handleSuccess({
      success: true,
      message: "Git repository initialized successfully",
      isRepo: false,
      path,
      gitDir: initResult.data,
    });
  }, "POST /api/git/init");
}
