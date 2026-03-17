import path from "path";
import fs from "fs/promises";
import { withErrorHandler, handleSuccess } from "@/lib/api/error-handler";

export async function GET() {
  return withErrorHandler(async () => {
    const cwd = process.cwd();
    const dataPath = path.join(cwd, 'data/workspaces');

    let files: string[] = [];
    let error: string | null = null;

    try {
      files = await fs.readdir(dataPath);
    } catch (e: any) {
      error = e.message;
    }

    return handleSuccess({
      cwd,
      dataPath,
      files,
      error,
      message: "Debug workspace storage path"
    });
  }, "GET /api/debug-workspaces");
}
