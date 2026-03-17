import { NextRequest } from "next/server";
import { getTalosClient } from "@/lib/talos-client";

/**
 * GET /api/tasks/[taskId]/stream
 * Server-Sent Events (SSE) endpoint for real-time task progress streaming
 *
 * This endpoint maintains a connection with the client and sends periodic updates
 * about task progress. Uses polling mechanism as the current Socket protocol
 * doesn't support bidirectional streaming.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  if (!taskId) {
    return new Response(JSON.stringify({ error: "Task ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = getTalosClient();

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let intervalId: NodeJS.Timeout | null = null;
      let previousStatus: string | null = null;

      try {
        // Send initial connection message
        const data = `data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`;
        controller.enqueue(encoder.encode(data));

        // Start polling for task status
        intervalId = setInterval(async () => {
          try {
            const task = await client.getTaskStatus(taskId);

            // Only send update if status changed
            if (task.status !== previousStatus) {
              previousStatus = task.status;

              const update = {
                type: 'progress',
                data: task,
              };

              const sseData = `data: ${JSON.stringify(update)}\n\n`;
              controller.enqueue(encoder.encode(sseData));

              // Stop polling if task is completed or failed
              if (task.status === 'completed' || task.status === 'failed' || task.status === 'stopped') {
                if (intervalId) {
                  clearInterval(intervalId);
                  intervalId = null;
                }

                // Send final message and close
                const finalData = `data: ${JSON.stringify({ type: 'complete', status: task.status })}\n\n`;
                controller.enqueue(encoder.encode(finalData));
                controller.close();
              }
            }
          } catch (error) {
            // Send error and close connection
            const errorData = `data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            if (intervalId) {
              clearInterval(intervalId);
            }
            controller.close();
          }
        }, 2000); // Poll every 2 seconds

        // Send keepalive comments every 15 seconds
        const keepaliveId = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            clearInterval(keepaliveId);
          }
        }, 15000);

        // Cleanup on connection close
        request.signal.addEventListener('abort', () => {
          if (intervalId) {
            clearInterval(intervalId);
          }
          clearInterval(keepaliveId);
          controller.close();
        });
      } catch (error) {
        const errorData = `data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
