import { NextRequest } from "next/server";
import { GitCommit } from "@talos/git";
import { withErrorHandler, handleSuccess, handleNotFoundError, handleValidationError } from "@/lib/api/error-handler";

/**
 * GET /api/commits/[hash]/diff
 * 获取 commit 的详细 diff 内容
 *
 * 返回格式:
 * - hash: string - 完整 commit hash
 * - message: string - Commit message
 * - author: string - 作者
 * - date: string - 提交日期
 * - diff: string - Diff 内容
 *
 * Response (404):
 * - Commit 不存在
 *
 * Response (400):
 * - 不在 git 仓库中
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  return withErrorHandler(async () => {
    const { hash } = await params;

    // 验证 hash 格式（至少 7 个 hex 字符）
    if (!/^[a-f0-9]{7,}$/i.test(hash)) {
      return handleValidationError("Invalid commit hash format", { hash });
    }

    // 使用 GitCommit 获取 commit 详情
    const gitCommit = new GitCommit(process.cwd());
    const result = await gitCommit.show(hash);

    if (!result.success) {
      // 判断是否是 commit 不存在的错误
      const errorMessage = result.error || "";
      if (errorMessage.includes("bad revision") || errorMessage.includes("unknown revision") || errorMessage.includes("Not a valid commit")) {
        return handleNotFoundError("Commit", hash);
      }
      // 判断是否是不在 git 仓库的错误 - this is a validation error
      if (errorMessage.includes("not a git repository") || errorMessage.includes("fatal: not a git")) {
        return handleValidationError("This directory is not a git repository");
      }
      // 其他错误 - throw to let withErrorHandler handle it
      throw new Error(errorMessage);
    }

    return handleSuccess(result.data);
  }, "GET /api/commits/[hash]/diff");
}
