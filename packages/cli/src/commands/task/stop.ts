/**
 * Task Stop Command
 *
 * Stop task by requesting via TalosClient to Talos main process
 */

import { TalosClient } from "@/client/TalosClient";

export interface TaskStopOptions {
  reason?: string;
}

export async function stopTaskCommand(
  taskId: string,
  options: TaskStopOptions = {}
): Promise<void> {
  const client = new TalosClient();

  try {
    await client.connect();

    await client.stopTask({
      taskId,
      reason: options.reason || "Task stop requested by CLI",
    });

    console.log(`✓ Task stopped: ${taskId}`);
    console.log(``);
    console.log(`View task logs:`);
    console.log(`  • tail -f .talos/logs/${taskId}.log`);
    console.log(`  • talos logs`);
  } catch (error) {
    console.error(`✗ Stop failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(``);
    console.error(`Possible reasons:`);
    console.error(`  • Talos main process is not running`);
    console.error(`  • Task does not exist`);
    console.error(``);
    console.error(`Solutions:`);
    console.error(`  • Run 'talos start' to start Talos`);
    console.error(`  • Run 'talos task list' to check tasks`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}
