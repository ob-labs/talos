import { spawn } from "child_process";
import type { RalphAgent, RalphToolContext } from "./RalphAgent.js";

/** Same as PRD Qoder agent: `TALOS_QODER_CLI`, default `qodercli`. */
function resolveQoderCliCommand(): string {
  const fromEnv = process.env.TALOS_QODER_CLI?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "qodercli";
}

/**
 * Headless PRD → Ralph JSON via Qoder CLI (`qodercli`).
 * Qoder does not treat trailing argv as the first user message; `-p` / `--print` passes `taskContent` as the first turn (same as QoderPrdAgent bootstrap).
 */
export class QoderRalphAgent implements RalphAgent {
  readonly displayName = "Qoder CLI";

  async run({
    projectRoot,
    taskContent,
    spinner,
    identifier,
    ralphDir,
  }: RalphToolContext): Promise<void> {
    const bin = resolveQoderCliCommand();
    const args = ["-w", projectRoot, "-f", "stream-json", "-p", taskContent];

    let hasOutput = false;
    const stopSpinnerAndShow = () => {
      if (!hasOutput) {
        hasOutput = true;
        spinner.stop();
        console.log(`\u{1F916} Qoder CLI PRD conversion in progress...\n`);
      }
    };

    // stream-json is NDJSON on stdout; do not echo (unlike Claude/Cursor print text). Drain to avoid backpressure.
    const proc = spawn(bin, args, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "inherit"],
    });

    if (proc.stdout)
      proc.stdout.on("data", () => {
        stopSpinnerAndShow();
      });

    return new Promise((resolve, reject) => {
      proc.on("close", (code) => {
        spinner.stop();
        if (code === 0) {
          console.log("");
          console.log("\u2705 PRD conversion completed");
          console.log("");
          console.log("\u{1F4CB} Usage:");
          console.log(`   cd ${ralphDir}`);
          console.log(`   talos task start --prd ${identifier}`);
          resolve();
        } else {
          console.error(`\n\u274c ${bin} exited with code: ${code ?? 1}`);
          console.error(
            "Tip: install and log in to Qoder CLI; set TALOS_QODER_CLI if the binary name differs."
          );
          process.exit(code ?? 1);
        }
      });
      proc.on("error", (error) => {
        spinner.stop();
        reject(error);
      });
    });
  }
}
