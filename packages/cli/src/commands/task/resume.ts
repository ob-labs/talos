/**
 * Task Resume Command
 *
 * Resume stopped task by requesting via TalosClient to Talos main process
 */

import { TalosClient } from "@/client/TalosClient";

export interface TaskResumeOptions {
  /** Enable debug mode */
  debug?: boolean;
  /** Tool to use for task execution (claude or cursor) */
  tool?: string;
  /** Model name */
  model?: string;
}

const colors = {
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

function validateTool(tool?: string): string | undefined {
  if (!tool) return undefined;
  const validTools = ['claude', 'cursor'];
  const normalizedTool = tool.toLowerCase();
  if (!validTools.includes(normalizedTool)) {
    console.error(`${colors.red}✗${colors.reset} Invalid tool value: "${tool}"`);
    console.error(`Supported tools: ${validTools.join(', ')}`);
    console.error(`Default tool: claude`);
    process.exit(1);
  }
  return normalizedTool;
}

export async function resumeTaskCommand(
  taskId: string,
  options: TaskResumeOptions = {}
): Promise<void> {
  const tool = validateTool(options.tool);
  const client = new TalosClient();

  try {
    await client.connect();

    await client.resumeTask({
      taskId,
      options: {
        debug: options.debug,
        tool,
        model: options.model,
      },
    });

    console.log(`✓ Task resumed: ${taskId}`);
    console.log(``);
    console.log(`View task logs:`);
    console.log(`  • tail -f .talos/logs/${taskId}.log`);
    console.log(`  • talos task attach ${taskId}`);
  } catch (error) {
    console.error(`✗ Resume failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(``);
    console.error(`Possible reasons:`);
    console.error(`  • Talos main process is not running`);
    console.error(`  • Task does not exist`);
    console.error(`  • Task status does not allow resume`);
    console.error(``);
    console.error(`Solutions:`);
    console.error(`  • Run 'talos start' to start Talos`);
    console.error(`  • Run 'talos task list' to check task status`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}
