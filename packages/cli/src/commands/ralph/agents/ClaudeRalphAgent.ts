import { spawn } from "child_process";
import type { RalphAgent, RalphToolContext } from "./RalphAgent.js";

/**
 * Headless PRD → Ralph JSON conversion via Claude Code (`claude` CLI, stdin pipe).
 */
export class ClaudeRalphAgent implements RalphAgent {
  readonly displayName = "Claude Code";

  async run({
    projectRoot,
    taskContent,
    model,
    spinner,
    identifier,
    ralphDir,
  }: RalphToolContext): Promise<void> {
    const args = ["--dangerously-skip-permissions", "--print"];
    if (model) args.push("--model", model);

    const env = { ...process.env };
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;

    const proc = spawn("claude", args, {
      cwd: projectRoot,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let hasOutput = false;
    const stopSpinnerAndShow = () => {
      if (!hasOutput) {
        hasOutput = true;
        spinner.stop();
        console.log(`\U0001f916 Claude Code PRD conversion in progress...\n`);
      }
    };

    if (proc.stdin) {
      proc.stdin.write(taskContent);
      proc.stdin.end();
    }
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
      proc.on("close", (code) => {
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
          console.error(`\n\u274c Claude Code exited with code: ${code ?? 1}`);
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
