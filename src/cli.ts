import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cac } from "cac";
import { select, isCancel } from "@clack/prompts";
import { sync } from "./sync.js";
import { resolveBuiltinWorkflowDir, resolveGitWorkflowDir } from "./registry.js";
import { PACKAGE_DIR } from "./paths.js";

function getBuiltinWorkflows(): { name: string; description: string }[] {
  const workflowsDir = join(PACKAGE_DIR, "workflows");
  if (!existsSync(workflowsDir)) return [];

  return readdirSync(workflowsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((entry) => {
      const mdPath = join(workflowsDir, entry.name, "workflow.md");
      let description = "";
      if (existsSync(mdPath)) {
        const raw = readFileSync(mdPath, "utf-8");
        const match = raw.match(/^#\s+(.+)$/m);
        if (match) description = match[1];
      }
      return { name: entry.name, description };
    });
}

// Scan sourceDir/workflows/ for workflow directories
function getSourceWorkflows(sourceDir: string): { name: string; dir: string; description: string }[] {
  const workflowsDir = join(sourceDir, "workflows");
  if (!existsSync(workflowsDir)) return [];

  return readdirSync(workflowsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((entry) => {
      const workflowDir = join(workflowsDir, entry.name);
      const mdPath = join(workflowDir, "workflow.md");
      if (!existsSync(mdPath)) return null;
      const raw = readFileSync(mdPath, "utf-8");
      const match = raw.match(/^#\s+(.+)$/m);
      const description = match ? match[1] : "";
      return { name: entry.name, dir: workflowDir, description };
    })
    .filter((w): w is { name: string; dir: string; description: string } => w !== null);
}

function isLocalPath(source: string): boolean {
  return source.startsWith("/") || source.startsWith("./") || source.startsWith("../");
}

function isGitUrl(source: string): boolean {
  return source.startsWith("http://") || source.startsWith("https://") || source.startsWith("git@");
}

async function resolveSourceWithFallbacks(url: string): Promise<string> {
  const refs = ["main", "master"];
  const lastError: Error[] = [];

  for (const ref of refs) {
    try {
      return resolveGitWorkflowDir(url, ref);
    } catch (e) {
      lastError.push(e as Error);
    }
  }

  throw new Error(`Failed to clone git repo. Tried refs: ${refs.join(", ")}. Last error: ${lastError[lastError.length - 1]?.message}`);
}

const cli = cac("talos");

cli.version(import.meta.env.PKG_VERSION as string);
cli.usage("[command] [options]");

cli.command("list", "列出可用的 workflows").action(() => {
  const workflows = getBuiltinWorkflows();
  if (workflows.length === 0) {
    console.log("No workflows found.");
    return;
  }
  for (const wf of workflows) {
    console.log(`  ${wf.name}${wf.description ? " — " + wf.description : ""}`);
  }
});

cli
  .command("install [name]", "安装 workflow 到当前目录")
  .option("--source <source>", "本地路径或 git URL")
  .action(async (name?: string, options?: { source?: string }) => {
    let workflowName: string;
    let workflowDir: string;

    if (options?.source) {
      let sourceDir: string;
      if (isLocalPath(options.source)) {
        sourceDir = options.source;
      } else if (isGitUrl(options.source)) {
        sourceDir = await resolveSourceWithFallbacks(options.source);
      } else {
        console.log("Source must be a local path (starting with /, ./, or ../) or a git URL.");
        process.exit(1);
      }

      const sourceWorkflows = getSourceWorkflows(sourceDir);
      if (sourceWorkflows.length === 0) {
        console.log(`Error: no workflows found in source (missing workflow.md)`);
        process.exit(1);
      }

      if (!name) {
        const selected = await select({
          message: "Select a workflow to install",
          options: sourceWorkflows.map((wf) => ({
              value: wf.name,
              label: wf.name,
              hint: wf.description,
            })),
          });
          if (isCancel(selected)) process.exit(0);
          const selectedName = selected as string;
          const wf = sourceWorkflows.find((w) => w.name === selectedName);
          if (!wf) {
            console.log(`Error: workflow "${selectedName}" not found`);
            process.exit(1);
          }
          workflowName = wf.name;
          workflowDir = wf.dir;
      } else {
        const wf = sourceWorkflows.find((w) => w.name === name);
        if (!wf) {
          console.log(`Workflow "${name}" not found in source. Available: ${sourceWorkflows.map((w) => w.name).join(", ")}`);
          process.exit(1);
        }
        workflowName = name;
        workflowDir = wf.dir;
      }
    } else {
      const workflows = getBuiltinWorkflows();
      if (workflows.length === 0) {
        console.log("No workflows found.");
        process.exit(1);
      }

      if (!name) {
        const selected = await select({
          message: "Select a workflow to install",
          options: workflows.map((wf) => ({
            value: wf.name,
            label: wf.name,
            hint: wf.description,
          })),
        });
        if (isCancel(selected)) process.exit(0);
        workflowName = selected as string;
      } else {
        const workflow = workflows.find((w) => w.name === name);
        if (!workflow) {
          console.log(`Builtin workflow "${name}" not found. Available: ${workflows.map((w) => w.name).join(", ")}`);
          process.exit(1);
        }
        workflowName = name;
      }

      workflowDir = resolveBuiltinWorkflowDir(workflowName);
    }

    const targetDir = process.cwd();
    await sync(workflowName, workflowDir, targetDir);
  });

cli
  .command("graph", "启动 web dashboard 查看会话执行图")
  .option("--port <port>", "端口号", { default: 3456 })
  .action(async (options: { port: number }) => {
    const { startServer } = await import("./server.js");
    await startServer({ port: options.port });
  });

cli.help();
cli.parse();
