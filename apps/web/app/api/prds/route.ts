import { storage, PRDManager } from '@talos/core';
import type { PRD } from "@/types";
import {
  handleSuccess,
  withErrorHandler,
} from "@/lib/api/error-handler";

/**
 * GET /api/prds
 * Returns an array of all configured PRDs
 */
export async function GET() {
  return withErrorHandler(async () => {
    const files = await storage.listFiles("data/prds", ".json");

    const prds: Array<PRD & { id: string; createdAt: string }> = [];
    for (const file of files) {
      const prdId = file.replace(".json", "");
      const prdManager = new PRDManager(process.cwd(), prdId);
      const prd = await prdManager.getPRD();
      const stats = await storage.getFileStats(`data/prds/${file}`);
      if (prd) {
        prds.push({
          ...prd,
          id: prdId,
          createdAt: stats?.birthtime.toISOString() || new Date().toISOString(),
        });
      }
    }

    return handleSuccess(prds);
  }, "GET /api/prds");
}
