/**
 * Task Health Command
 *
 * Check task health status using TalosClient
 */

import { TalosClient } from "@/client/TalosClient";

export interface TaskHealthOptions {
  json?: boolean;
}

export async function taskHealthCommand(
  taskId: string,
  options: TaskHealthOptions = {}
): Promise<void> {
  const client = new TalosClient();

  try {
    await client.connect();

    const health = await client.getTaskHealth(taskId);

    if (options.json) {
      console.log(JSON.stringify(health, null, 2));
      return;
    }

    console.log(`🏥 Task Health Check`);
    console.log(`Task ID: ${taskId}\n`);

    if (health.isHealthy) {
      console.log(`✅ Healthy`);
      console.log(`   Status: ${health.status}`);
      if (health.details) {
        if (health.details.taskId) console.log(`   Task ID: ${health.details.taskId}`);
        if (health.details.prdId) console.log(`   PRD ID: ${health.details.prdId}`);
      }
    } else {
      console.log(`❌ Unhealthy`);
      console.log(`   Status: ${health.status}`);
      if (health.details?.error) {
        console.log(`   Error: ${health.details.error}`);
      }
    }
    console.log("");
  } catch (error) {
    console.error(`✗ Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(``);
    console.error(`Please ensure Talos main process is running`);
    console.error(`Run 'talos start' to start Talos`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}
