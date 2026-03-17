import { NextRequest } from "next/server";
import type { TerminalLog } from "@/types";

/**
 * GET /api/terminal/[worktreeId]/stream
 *
 * Server-Sent Events endpoint for real-time terminal log updates.
 *
 * Client connects with EventSource and receives:
 * - log: When a new log entry is added
 * - complete: When the stream is closed
 *
 * Query parameters:
 * - storyId?: string - Optional story ID to filter logs (if not provided, returns worktree-level logs)
 *
 * Example client code:
 * ```ts
 * const eventSource = new EventSource('/api/terminal/worktree_123/stream');
 * eventSource.addEventListener('log', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('New log:', data);
 * });
 * eventSource.addEventListener('complete', (e) => {
 *   eventSource.close();
 * });
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worktreeId: string }> }
) {
  const { worktreeId } = await params;
  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get("storyId") || undefined;

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Track last log count to detect new logs
      let lastLogCount = 0;
      let lastLogs: TerminalLog[] = [];

      // Send initial logs
      const sendInitialLogs = async () => {
        try {
          const logs = storyId
            ? [] as TerminalLog[] // TODO: terminalLogger.getTaskLogs not implemented
            : [] as TerminalLog[] // TODO: terminalLogger.getFeatLogs not implemented;

          lastLogs = logs;
          lastLogCount = logs.length;

          // Send all existing logs as initial state
          sendEvent(controller, encoder, "initial", {
            worktreeId,
            storyId,
            logs,
            count: logs.length,
          });
        } catch (error) {
          console.error("Error sending initial logs:", error);
          sendEvent(controller, encoder, "error", {
            worktreeId,
            storyId,
            error: "Failed to load logs",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      };

      // Send initial logs
      sendInitialLogs();

      // Poll for new logs
      const intervalId = setInterval(async () => {
        try {
          const currentLogs = storyId
            ? [] as TerminalLog[] // TODO: terminalLogger.getTaskLogs not implemented
            : [] as TerminalLog[] // TODO: terminalLogger.getFeatLogs not implemented;

          // Check if there are new logs
          if (currentLogs.length > lastLogCount) {
            const newLogs = currentLogs.slice(lastLogCount);

            for (const log of newLogs) {
              sendEvent(controller, encoder, "log", {
                worktreeId,
                storyId,
                log,
              });
            }

            lastLogs = currentLogs;
            lastLogCount = currentLogs.length;
          }
        } catch (error) {
          console.error("Error polling logs:", error);
        }
      }, 300); // Poll every 300ms for more responsive updates

      // Clean up interval on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        sendEvent(controller, encoder, "complete", {
          worktreeId,
          storyId,
          message: "Stream closed",
        });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

/**
 * Helper function to send SSE event
 */
function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: string,
  data: unknown
): void {
  const formattedData = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(`event: ${event}\n`));
  controller.enqueue(encoder.encode(formattedData));
}
