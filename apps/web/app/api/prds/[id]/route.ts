import { NextRequest } from "next/server";
import type { PRD } from "@/types";
import { PRDManager } from "@talos/core";
import { withErrorHandler, handleSuccess, handleNotFoundError } from "@/lib/api/error-handler";

/**
 * GET /api/prds/[id]
 * Returns a single PRD by ID or 404 if not found
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

    return handleSuccess(prd);
  }, "GET /api/prds/[id]");
}
