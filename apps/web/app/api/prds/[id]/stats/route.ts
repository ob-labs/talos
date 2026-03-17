import { NextRequest } from "next/server";
import { storage, PRDManager } from '@talos/core';
import { withErrorHandler, handleSuccess, handleNotFoundError, handleAPIError } from "@/lib/api/error-handler";

/**
 * GET /api/prds/[id]/stats
 * Returns file statistics for a PRD (creation time, modification time, size)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withErrorHandler(async () => {
    const { id } = await params;
    const prdManager = new PRDManager(process.cwd(), id);
  const prd = await prdManager.getPRD();

    if (!prd) {
      return handleNotFoundError("PRD", id);
    }

    const prdPath = `data/prds/${id}.json`;
    const stats = await storage.getFileStats(prdPath);

    if (!stats) {
      return handleAPIError(new Error("Could not retrieve file statistics"));
    }

    return handleSuccess({
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      size: stats.size,
    });
  }, "GET /api/prds/[id]/stats");
}
