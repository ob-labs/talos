import { NextRequest } from "next/server";
import { logger } from "@/lib/utils/logger";
import { withErrorHandler, handleSuccess, handleValidationError } from "@/lib/api/error-handler";

/**
 * POST /api/logs/errors - Log client-side errors
 */
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const body = await request.json();
    const { message, stack, componentStack, url } = body;

    if (!message) {
      return handleValidationError("Message is required", { field: "message" });
    }

    // Log the error with context
    logger.error(
      `Client-side error: ${message}`,
      stack ? new Error(message) : undefined,
      {
        componentStack,
        url,
        userAgent: request.headers.get("user-agent"),
      }
    );

    return handleSuccess({ success: true });
  }, "POST /api/logs/errors");
}
