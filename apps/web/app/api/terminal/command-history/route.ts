import { LocalStorageEngine } from '@talos/core';
import { withErrorHandler, handleSuccess } from "@/lib/api/error-handler";

export interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  workspaceId?: string;
  worktreeId?: string;
}

export interface CommandHistoryData {
  commands: CommandHistoryEntry[];
  maxSize: number;
}

const storage = new LocalStorageEngine();
const storageKey = "data/terminal/command-history.json";

/**
 * GET /api/terminal/command-history
 * Get command history
 */
export async function GET() {
  return withErrorHandler(async () => {
    const data = await storage.readJSON<CommandHistoryData>(storageKey);
    if (data && Array.isArray(data.commands)) {
      return handleSuccess({ success: true, data });
    }
    return handleSuccess({
      success: true,
      data: { commands: [], maxSize: 1000 }
    });
  }, "GET /api/terminal/command-history");
}
