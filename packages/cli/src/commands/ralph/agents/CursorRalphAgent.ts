import { spawn } from "child_process";
import type { RalphAgent, RalphToolContext } from "./RalphAgent.js";

/**
 * Headless PRD → Ralph JSON conversion via Cursor Agent (`cursor-agent` CLI).
 */
export class CursorRalphAgent implements RalphAgent {
  readonly displayName = "Cursor Agent";

  async run({
    projectRoot,
    taskContent,
    model,
    spinner,
    identifier,
    ralphDir,
  }: RalphToolContext): Promise<void> {
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join: pathJoin } = await import("node:path");

    const tempDir = await mkdtemp(pathJoin(tmpdir(), "talos-ralph-cursor-"));
    const tempFile = pathJoin(tempDir, "prompt.txt");
    await writeFile(tempFile, taskContent, "utf-8");

    const args = ["--print", "--trust", "--force"];
    if (model) args.push("--model", model);

    const shellCommand = `cat "${tempFile}" | cursor-agent ${args.join(" ")}`;

    let hasOutput = false;
    const stopSpinnerAndShow = () => {
      if (!hasOutput) {
        hasOutput = true;
        spinner.stop();
        console.log(`\U0001f916 Cursor Agent PRD conversion in progress...\n`);
      }
    };

    const proc = spawn("sh", ["-c", shellCommand], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (proc.stdout)
      proc.stdout.on("data", (data) => {
        stopSpinnerAndShow();
        process.stdout.write(data);
      });
    if (proc.stderr)
      proc.stderr.on("data", (data) => {
        stopSpinnerAndShow();
        process.stderr.write(data);
      });

    return new Promise((resolve, reject) => {
      proc.on("close", async (code) => {
        try {
          await rm(tempDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
        spinner.stop();
        if (code === 0) {
          console.log("");
          console.log("\u2705 PRD conversion completed");
          console.log("");
          console.log("\U0001f4cb Usage:");
          console.log(`   cd ${ralphDir}`);
          console.log(`   talos task start --prd ${identifier}`);
          resolve();
        } else {
          console.error(`\n\u274c Cursor Agent exited with code: ${code ?? 1}`);
          console.error("Tip: ensure CURSOR_API_KEY is set, or run `cursor-agent login`.");
          process.exit(code ?? 1);
        }
      });
      proc.on("error", async (error) => {
        try {
          await rm(tempDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
        spinner.stop();
        reject(error);
      });
    });
  }
}
