/**
 * TaskLifecycleManager - Task lifecycle management
 *
 * Manages task lifecycle: start, stop, resume.
 * Uses rich domain model: Task entity always includes PRD entity.
 */

import type { IProcessManager, ILogger, ToolType } from "@talos/types";
import type { ITaskLifecycleManager } from "@talos/types";
import type { IEventBus } from "@talos/types";
import type { IWorkspaceRepository } from "@talos/types";
import * as path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

import { Task } from "@/domain/entities/Task";
import type { TaskProperties } from "@/domain/entities/Task";
import { PRD } from "@/domain/entities/PRD";
import { Workspace } from "@/domain/entities/Workspace";
import { Worktree } from "@/domain/entities/Worktree";
import { TaskRepository } from "@/domain/repositories/TaskRepository";
import { PRDRepository } from "@/repositories/prd-repository";

export interface TaskLifecycleManagerDependencies {
  processManager: IProcessManager;
  eventBus: IEventBus;
  logger: ILogger;
  basePath: string;
  workspaceRepository: IWorkspaceRepository;
}

interface TaskInfo {
  task: {
    pid?: number;
    workingDir?: string;
  };
  workspace?: {
    path: string;
    name: string;
  };
}

export class TaskLifecycleManager implements ITaskLifecycleManager {
  private processManager: IProcessManager;
  private eventBus: IEventBus;
  private logger: ILogger;
  private basePath: string;
  private workspaceRepository: IWorkspaceRepository;

  constructor(deps: TaskLifecycleManagerDependencies) {
    this.processManager = deps.processManager;
    this.eventBus = deps.eventBus;
    this.logger = deps.logger;
    this.basePath = deps.basePath;
    this.workspaceRepository = deps.workspaceRepository;
  }

  private createTaskRepository(repoRoot: string): TaskRepository {
    return new TaskRepository(repoRoot);
  }

  private createPRDRepository(repoRoot: string): PRDRepository {
    return new PRDRepository(repoRoot);
  }

  /**
   * @throws Error if PRD not found
   */
  private async loadPRD(repoRoot: string, prdId: string): Promise<PRD> {
    const prdRepository = this.createPRDRepository(repoRoot);
    const prdData = await prdRepository.findById(prdId);

    if (!prdData) {
      throw new Error(`PRD '${prdId}' not found in repository at ${repoRoot}`);
    }

    return PRD.fromDTO({
      id: prdData.id,
      project: prdData.project,
      description: prdData.description,
      branchName: prdData.branchName,
      userStories: prdData.userStories || [],
      status: prdData.status || "draft",
      createdAt: prdData.createdAt || Date.now(),
      updatedAt: prdData.updatedAt,
    });
  }

  /**
   * @throws Error if task is found but has invalid data
   */
  private async findTaskByProcessId(processId: string): Promise<TaskInfo | null> {
    const workspaces = await this.workspaceRepository.findAll();

    for (const ws of workspaces) {
      try {
        const taskRepository = new TaskRepository(ws.path);
        const task = await taskRepository.findById(processId);

        if (task) {
          // Require worktree to be set - no fallback (Fail Fast principle)
          if (!task.worktree) {
            throw new Error(`Task ${task.id} has no worktree set`);
          }

          return {
            task: {
              pid: task.pid,
              workingDir: task.worktree.path,
            },
            workspace: {
              path: ws.path,
              name: ws.name,
            },
          };
        }
      } catch (error) {
        // Skip workspaces with errors and continue searching
        continue;
      }
    }

    return null;
  }

  /**
   * Start a new task
   *
   * @param prdId - PRD identifier
   * @param workingDir - Working directory for task execution
   * @param debug - Enable debug mode for detailed logging
   * @param tool - Tool to use for task execution (e.g., "claude", "cursor")
   * @returns Task execution result with taskId, processId, and pid
   * @throws Error if PRD not found, task already exists, or worktree creation fails
   */
  async startTask(
    prdId: string,
    workingDir: string,
    debug?: boolean,
    tool?: string,
    model?: string
  ): Promise<{ taskId: string; processId: string; pid: number }> {
    this.logger.info(`📦 Starting task: PRD=${prdId}, dir=${workingDir}`);

    // Find workspace using WorkspaceRepository.findByPathContains()
    let workspaceName = path.basename(workingDir);
    let workspaceConfig: any = undefined;

    try {
      const foundWorkspace = await (this.workspaceRepository as any).findByPathContains?.(workingDir);
      if (foundWorkspace) {
        workspaceConfig = foundWorkspace;
        workspaceName = foundWorkspace.name;
        this.logger.info(`📁 Found workspace: ${workspaceName} at ${foundWorkspace.path}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️  Failed to find workspace by path: ${error instanceof Error ? error.message : String(error)}`);
    }

    const repoRoot = workspaceConfig?.path || workingDir;

    // Load PRD entity (充血模型 - PRD entity is required)
    const prd = await this.loadPRD(repoRoot, prdId);
    const branchName = prd.branchName || 'ralph/' + prdId;
    this.logger.info(`📖 PRD loaded: ${prdId}, branch: ${branchName}`);

    const taskId = `${workspaceName}-${prdId}`;

    // Check if task already exists (Fail Fast - fail early if duplicate)
    const taskRepository = this.createTaskRepository(repoRoot);
    const existingTask = await taskRepository.findById(taskId);
    if (existingTask) {
      throw new Error(`Task ${taskId} already exists with status: ${existingTask.status}`);
    }

    // Build command string
    const toolOption = tool ? ` --tool ${tool}` : '';
    const command = `talos task start --prd ${prdId}${toolOption}`;

    // Create worktree for task execution using Worktree entity
    const { worktree, actualWorkingDir } = await this.createWorktreeForTask(
      repoRoot,
      taskId,
      prdId,
      branchName
    );

    // Create Task entity using rich domain model with PRD entity (充血模型)
    const taskProperties: TaskProperties = {
      id: taskId,
      title: `Execute PRD: ${prdId}`,
      description: `Task for PRD ${prdId} in workspace ${workspaceName}`,
      command,
      tool: tool as ToolType | undefined,
      workspace: workspaceName,
      prd,
      branch: branchName,
      worktree,
      repoRoot,
      timestamp: Date.now(),
    };

    const task = Task.create(taskProperties);

    // Execute task start using unified method
    const pid = await this.executeTaskStart(task, taskRepository, prdId, "start", {
      repoRoot,
      workspace: workspaceName,
      workingDir: actualWorkingDir,
      debug,
      tool,
    });

    this.logger.info(`✅ Task started: ${taskId}, PID: ${pid}`);

    return { taskId, processId: taskId, pid };
  }

  /**
   * Stop a running task
   *
   * Stops the task process with SIGTERM.
   * Updates task state to 'stopped' first, then stops the process.
   * This order prevents health checks from marking the task as failed.
   *
   * @param processId - Process identifier to stop
   * @param reason - Optional reason for stopping
   */
  async stopTask(processId: string, reason?: string): Promise<void> {
    this.logger.info(`🛑 Stopping task: ${processId}${reason ? ` (${reason})` : ''}`);

    const taskInfo = await this.findTaskByProcessId(processId);
    if (!taskInfo || !taskInfo.task.pid) {
      throw new Error(`Process ${processId} not found`);
    }
    const { pid } = taskInfo.task;
    const { workspace } = taskInfo;
    if (!workspace) {
      throw new Error(`Task ${processId} has no workspace`);
    }

    // Update state to 'stopped' before stopping process (prevents health check from marking as failed)
    const taskRepository = this.createTaskRepository(workspace.path);
    const task = await taskRepository.findById(processId);
    if (!task) {
      throw new Error(`Task ${processId} not found`);
    }

    task.stop();
    await taskRepository.save(task);
    this.logger.info(`📝 Task ${processId} state updated to 'stopped'`);

    // Stop the process (ProcessManager handles graceful shutdown and SIGKILL if needed)
    await this.processManager.stopProcessGroup(pid, "SIGTERM");
  }

  /**
   * Resume a stopped task
   *
   * @param processId - Process identifier to resume
   * @param debug - Enable debug mode for detailed logging
   * @param tool - Tool to use for task execution
   * @throws Error if task not found, invalid state, or working directory missing
   */
  async resumeTask(
    processId: string,
    debug?: boolean,
    tool?: string,
    model?: string
  ): Promise<void> {
    this.logger.info(`▶️  Resuming task: ${processId}`);

    const taskInfo = await this.findTaskByProcessId(processId);
    if (!taskInfo) {
      throw new Error(`Task ${processId} not found in storage`);
    }

    const actualWorkingDir = taskInfo.task?.workingDir;
    const { workspace } = taskInfo;

    if (!actualWorkingDir || !workspace) {
      throw new Error(`Task ${processId} has incomplete metadata`);
    }

    const taskRepository = this.createTaskRepository(workspace.path);
    const task = await taskRepository.findById(processId);

    if (!task) {
      throw new Error(`Task ${processId} not found`);
    }

    // Validate task state before resuming
    if (task.status !== "stopped" && task.status !== "failed") {
      throw new Error(`Cannot resume task with status: ${task.status}`);
    }

    // Verify workingDir exists
    try {
      const { promises: fs } = await import("fs");
      await fs.access(actualWorkingDir);
    } catch (error) {
      throw new Error(`Working directory does not exist: ${actualWorkingDir}`);
    }

    // Extract PRD ID from task ID (format: workspaceName-prdId)
    // Use workspace name to precisely extract PRD ID (handles workspace names with hyphens)
    const prefix = `${workspace.name}-`;
    const prdId = processId.startsWith(prefix) ? processId.slice(prefix.length) : processId;
    const prd = await this.loadPRD(workspace.path, prdId);
    this.logger.info(`📖 PRD loaded for resume: ${prdId}`);

    // Create full Task entity with PRD
    const fullTask = Task.create({
      id: task.id,
      title: task.title,
      description: task.description,
      command: task.command,
      tool: task.tool as ToolType | undefined,
      workspace: task.workspace,
      prd,
      branch: task.branch,
      worktree: task.worktree,
      repoRoot: workspace.path,
      pid: task.pid,
      processId: task.processId,
      progress: task.progress,
      timestamp: task.timestamp,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      storyId: task.storyId,
      role: task.role,
      error: task.error,
      conversation: task.conversation,
      status: task.status,
    });

    // Execute task start using unified method
    await this.executeTaskStart(fullTask, taskRepository, prdId, "resume", {
      repoRoot: workspace.path,
      workspace: task.workspace,
      workingDir: actualWorkingDir,
      debug,
      tool,
    });

    this.logger.info(`✅ Task resumed: ${processId}`);
  }

  private async spawnProcess(
    taskId: string,
    prdId: string,
    workingDir: string,
    logPath: string,
    options: { debug?: boolean; tool?: string }
  ): Promise<number> {
    // Use env var if set (bundled mode), otherwise resolve from workspace
    const ralphCliPath = process.env.TALOS_RALPH_CLI_PATH
      || require.resolve("@talos/executor/ralph-cli");
    const cleanedEnv = this.getCleanedEnv();

    const config = {
      prdName: prdId,
      workingDir,
      maxIterations: 20,
      tool: options?.tool || "claude",
      logFile: logPath,
      debug: options.debug || false,
    };

    const pid = await this.processManager.register("task", {
      command: "node",
      args: [ralphCliPath, JSON.stringify(config)],
      cwd: workingDir,
      detached: true,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      createGroup: true,
      env: {
        ...cleanedEnv,
        NODE_ENV: "production",
      },
      metadata: {
        taskId,
        prdId,
        workingDir,
      },
    });

    this.logger.info(`✅ Process spawned: PID ${pid}`);
    return pid;
  }

  private getCleanedEnv(): Record<string, string> {
    // Filter out undefined values from process.env
    const cleanedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        cleanedEnv[key] = value;
      }
    }
    delete cleanedEnv.CLAUDECODE;
    delete cleanedEnv.CLAUDE_CODE_ENTRYPOINT;
    return cleanedEnv;
  }

  private async verifyProcessRunning(
    pid: number,
    taskId: string,
    action: "start" | "resume"
  ): Promise<void> {
    const isRunning = await this.processManager.isAlive(pid);
    if (!isRunning) {
      throw new Error(
        `Process ${pid} died immediately after spawn. Task ${taskId} not ${action}ed.`
      );
    }
    this.logger.info(`✅ Process verified running: PID ${pid}`);
  }

  /**
   * Execute task start: spawn process, verify, update state, emit event
   *
   * This method contains the common "START" logic shared by both startTask and resumeTask.
   *
   * @param task - Task entity (will be modified)
   * @param taskRepository - Repository for saving task
   * @param prdId - PRD identifier
   * @param action - "start" or "resume"
   * @param options - Execution options
   * @returns Process ID
   */
  private async executeTaskStart(
    task: Task,
    taskRepository: TaskRepository,
    prdId: string,
    action: "start" | "resume",
    options: {
      repoRoot: string;
      workspace: string;
      workingDir: string;
      debug?: boolean;
      tool?: string;
    }
  ): Promise<number> {
    const logPath = task.getLogPath();

    // Log execution details
    this.logger.info(`🚀 ${action === "start" ? "Starting" : "Resuming"} task execution`);
    this.logger.info(`    PRD: ${prdId}`);
    this.logger.info(`    Working dir: ${options.workingDir}`);
    this.logger.info(`    Log path: ${logPath}`);
    if (options.tool) {
      this.logger.info(`    Tool: ${options.tool}`);
    }
    if (options.debug) {
      this.logger.info(`    Debug: ${options.debug}`);
    }

    // Spawn process
    const pid = await this.spawnProcess(task.id, prdId, options.workingDir, logPath, {
      debug: options.debug,
      tool: options.tool,
    });

    // Verify process is running
    await this.verifyProcessRunning(pid, task.id, action);

    // Update task state
    task.start();
    task.updateExecutionInfo({ pid, processId: task.id });
    await taskRepository.save(task);

    // Publish event
    this.eventBus.emit("task:started", {
      taskId: task.id,
      processId: task.id,
      pid,
      prdId,
      repoRoot: options.repoRoot,
      workspace: options.workspace,
    });

    return pid;
  }

  /**
   * Create worktree for task execution and copy PRD to worktree
   *
   * @param repoRoot - Repository root path
   * @param taskId - Task identifier
   * @param prdId - PRD identifier
   * @param branchName - Git branch name for worktree
   * @returns Worktree entity and actual working directory
   * @throws Error if worktree creation fails
   */
  private async createWorktreeForTask(
    repoRoot: string,
    taskId: string,
    prdId: string,
    branchName: string
  ): Promise<{ worktree: Worktree; actualWorkingDir: string }> {
    const worktreePath = `${repoRoot}/worktrees/${taskId}`;
    const worktree = await Worktree.create(repoRoot, worktreePath, branchName);

    this.logger.info(`✅ Worktree created: ${worktree.path}`);

    // Copy original PRD to worktree to ensure fresh state
    const { promises: fs } = await import("fs");
    const prdSourceDir = path.join(repoRoot, "ralph", prdId);
    const prdDestDir = path.join(worktree.path, "ralph", prdId);

    try {
      await fs.mkdir(path.dirname(prdDestDir), { recursive: true });
      await fs.cp(prdSourceDir, prdDestDir, { recursive: true, force: true });
      this.logger.info(`✅ Copied original PRD to worktree: ${prdDestDir}`);
    } catch (prdError) {
      this.logger.warn(`⚠️  Failed to copy PRD to worktree: ${prdError}`);
    }

    return { worktree, actualWorkingDir: worktree.path };
  }
}
