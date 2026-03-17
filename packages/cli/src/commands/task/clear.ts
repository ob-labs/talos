/**
 * Task Clear Command
 *
 * Batch clear all failed tasks using TalosClient
 */

import { createInterface } from "readline";
import { TalosClient } from "@/client/TalosClient";

export interface TaskClearOptions {
  force?: boolean;
}

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

async function promptConfirmation(count: number): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`Confirm delete these ${count} failed tasks? (y/N): `, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export async function clearTaskCommand(options: TaskClearOptions = {}): Promise<void> {
  const client = new TalosClient();

  try {
    await client.connect();

    const tasks = await client.listTasks({ status: "failed" });

    if (tasks.length === 0) {
      console.log("✓ No failed tasks to clear");
      return;
    }

    console.log(`Found ${tasks.length} failed tasks`);
    const taskIds = tasks.map(t => t.id).join(' / ');
    console.log(`  ${taskIds}`);
    console.log("");

    if (!options.force) {
      const confirmed = await promptConfirmation(tasks.length);
      if (!confirmed) {
        console.log("Cancelled");
        return;
      }
    }

    console.log("Clearing tasks...");
    const cleared = await client.clearFailedTasks();

    console.log(`${colors.green}✓${colors.reset} Clear completed: ${cleared} succeeded, 0 failed`);
    console.log("");
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} Clear failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(``);
    console.error(`Please ensure Talos main process is running`);
    console.error(`Run 'talos start' to start Talos`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}
