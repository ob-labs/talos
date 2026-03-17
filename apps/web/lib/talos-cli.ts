import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * CLI 命令执行客户端
 * 通过调用 talos CLI 命令获取数据
 */
export class TalosCLI {
  /**
   * 执行 talos 命令并返回 JSON 输出
   */
  private async execCommand(command: string, args: string[] = []): Promise<any> {
    try {
      const fullCommand = `talos ${command} ${args.join(' ')} --json`;
      const { stdout, stderr } = await execAsync(fullCommand, {
        env: { ...process.env, NODE_ENV: 'production' }
      });

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      return JSON.parse(stdout);
    } catch (error) {
      // 如果命令失败，返回空数组或 null
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 获取所有任务列表
   */
  async getTasks(options?: { workspace?: string }): Promise<any[]> {
    const args = [];
    if (options?.workspace) {
      args.push(`--workspace ${options.workspace}`);
    }
    const result = await this.execCommand('task list', args);
    return Array.isArray(result) ? result : [];
  }

  /**
   * 获取特定任务
   */
  async getTask(taskId: string): Promise<any | null> {
    const tasks = await this.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<any | null> {
    const tasks = await this.execCommand('task status', ['--no-watch']);
    if (Array.isArray(tasks)) {
      return tasks.find(t => t.id === taskId) || null;
    }
    return null;
  }

  /**
   * 读取任务日志
   */
  async getTaskLogs(taskId: string, lines: number = 100): Promise<{
    logPath: string;
    totalLines: number;
    lines: string[];
  }> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const { readFile } = await import('fs/promises');
    const logPath = `${task.workspace}/.talos/logs/${taskId}.log`;

    try {
      const logContent = await readFile(logPath, 'utf-8');
      const logLines = logContent.split('\n').filter(line => line.trim());
      const slicedLines = lines > 0 ? logLines.slice(-lines) : logLines;

      return {
        logPath,
        totalLines: logLines.length,
        lines: slicedLines,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          logPath,
          totalLines: 0,
          lines: [],
        };
      }
      throw error;
    }
  }

  /**
   * 获取 Git 状态
   */
  async getGitStatus(workingDir?: string): Promise<any> {
    const { execSync } = await import('child_process');
    const options = workingDir ? { cwd: workingDir } : {};
    try {
      const output = execSync('git status --porcelain', options);
      return output.toString().trim();
    } catch (error) {
      return '';
    }
  }

  /**
   * 获取 Git diff
   */
  async getGitDiff(workingDir?: string, file?: string): Promise<any> {
    const { execSync } = await import('child_process');
    const options = workingDir ? { cwd: workingDir } : {};
    const command = file ? `git diff ${file}` : 'git diff';
    try {
      const output = execSync(command, options);
      return output.toString();
    } catch (error) {
      return '';
    }
  }

  /**
   * 获取命令历史（通过读取本地存储）
   * 注意：这个可能需要直接访问文件系统
   */
  async getCommandHistory(): Promise<any> {
    const { readFile } = await import('fs/promises');
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const historyPath = `${homeDir}/.talos/data/terminal/command-history.json`;

    try {
      const content = await readFile(historyPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return { commands: [], maxSize: 1000 };
    }
  }
}

export const talosCLI = new TalosCLI();
