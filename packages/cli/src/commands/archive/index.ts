/**
 * Talos Archive Command
 *
 * 用于归档已完成的 PRD。
 * 将 PRD 文件从 ralph/ 目录移动到 archive/ 目录。
 *
 * Archive command for completed PRDs.
 * Moves PRD files from ralph/ to archive/ directory.
 */
import { join } from 'path';
import { mkdir, rm, copyFile, stat, readdir, readFile } from 'fs/promises';
import { Command } from 'commander';
import { GitRepository, GitWorktree } from '@talos/git';
import { WorkspaceRepository } from '@talos/core';

export interface ArchiveOptions {
  all?: boolean;
  force?: boolean;
}

/**
 * 归档指定的 PRD
 * Archive a specific PRD
 */
async function archivePRD(projectRoot: string, identifier: string): Promise<void> {
  const ralphBaseDir = join(projectRoot, 'ralph');
  const prdDir = join(ralphBaseDir, identifier);
  const prdJsonPath = join(prdDir, 'prd.json');
  const progressTxtPath = join(prdDir, 'progress.txt');

  // 检查 PRD 是否存在
  // Check if PRD exists
  try {
    await stat(prdJsonPath);
  } catch {
    console.error(`❌ PRD 不存在: ${identifier}`);
    return;
  }

  // 读取 PRD 数据
  // Read PRD data
  let prdData: { branchName?: string };
  try {
    const content = await readFile(prdJsonPath, 'utf-8');
    prdData = JSON.parse(content);
  } catch {
    console.error(`❌ 无法读取 PRD 文件: ${identifier}`);
    return;
  }

  const branchName = prdData.branchName;
  if (!branchName) {
    console.error(`❌ PRD 缺少 branchName 字段: ${identifier}`);
    return;
  }

  // 创建归档目录
  // Create archive directory
  const archiveBaseDir = join(projectRoot, 'archive');
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const archiveDir = join(archiveBaseDir, `${today}-${identifier}`);

  try {
    await mkdir(archiveDir, { recursive: true });

    console.log(`📦 归档 PRD: ${identifier} (${branchName})`);
    console.log(`   目标: ${archiveDir}`);

    // 复制文件
    // Copy files
    await copyFile(prdJsonPath, join(archiveDir, 'prd.json'));

    try {
      await stat(progressTxtPath);
      await copyFile(progressTxtPath, join(archiveDir, 'progress.txt'));
    } catch {
      // progress.txt 不存在，跳过
      // progress.txt doesn't exist, skip
    }

    // 删除原 PRD 目录
    // Delete original PRD directory
    await rm(prdDir, { recursive: true, force: true });

    console.log(`✅ 归档完成`);
  } catch (error) {
    console.error(`❌ 归档失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 列出所有可归档的 PRD
 * List all archivable PRDs
 */
async function listArchivablePRDs(projectRoot: string): Promise<string[]> {
  const ralphBaseDir = join(projectRoot, 'ralph');
  const prdIdentifiers: string[] = [];

  try {
    const entries = await readdir(ralphBaseDir);

    for (const entry of entries) {
      const entryPath = join(ralphBaseDir, entry);
      const stats = await stat(entryPath);

      if (stats.isDirectory()) {
        const prdJsonPath = join(entryPath, 'prd.json');
        try {
          await stat(prdJsonPath);
          
          // 读取 PRD 检查是否所有用户故事都已完成
          // Read PRD to check if all user stories are completed
          const content = await readFile(prdJsonPath, 'utf-8');
          const prd = JSON.parse(content);
          
          // 检查所有 userStories 的 passes 是否都为 true
          // Check if all userStories have passes: true
          const userStories = prd.userStories || [];
          if (userStories.length === 0) {
            // 没有 user stories，跳过
            // No user stories, skip
            continue;
          }
          
          const allCompleted = userStories.every((story: any) => story.passes === true);
          if (allCompleted) {
            prdIdentifiers.push(entry);
          }
        } catch {
          // 没有 prd.json 或读取失败，跳过
          // No prd.json or read failed, skip
        }
      }
    }
  } catch {
    // ralph/ 目录不存在
    // ralph/ directory doesn't exist
  }

  return prdIdentifiers;
}

/**
 * 归档命令主函数
 * Archive command main function
 */
export async function archiveCommand(options: ArchiveOptions & { identifier?: string } = {}): Promise<void> {
  // 获取主仓库根目录（通过 GitRepository）
  // Get main repository root path (via GitRepository)
  const cwd = process.cwd();
  const git = new GitRepository(cwd);
  const repoNameResult = await git.getRepoName();
  
  if (!repoNameResult.success || !repoNameResult.data) {
    console.error('❌ 错误：无法获取仓库名称');
    console.error(`Error: ${repoNameResult.error}`);
    process.exit(1);
  }
  
  const repoName = repoNameResult.data;
  
  // 通过仓库名称获取 workspace 配置（workspace.path 是准确的 repoRoot）
  const workspaceRepo = new WorkspaceRepository();
  const workspace = await workspaceRepo.findByName(repoName);
  
  if (!workspace) {
    console.error(`❌ 错误：找不到 workspace 配置 (repoName: ${repoName})`);
    console.error("Error: Workspace config not found");
    process.exit(1);
  }
  
  const projectRoot = workspace.path;

  // 如果指定了 identifier，归档指定的 PRD
  // If identifier is specified, archive specific PRD
  if (options.identifier) {
    await archivePRD(projectRoot, options.identifier);
    return;
  }

  // 如果 --all，归档所有 PRD
  // If --all, archive all PRDs
  if (options.all) {
    const prdIdentifiers = await listArchivablePRDs(projectRoot);

    if (prdIdentifiers.length === 0) {
      console.log('📋 没有找到可归档的 PRD');
      return;
    }

    console.log(`📋 找到 ${prdIdentifiers.length} 个可归档的 PRD:`);
    prdIdentifiers.forEach(id => console.log(`   - ${id}`));
    console.log('');

    if (!options.force) {
      const { createInterface } = await import('readline');
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('是否归档以上所有 PRD？(y/N): ', (input) => resolve(input.trim().toLowerCase()));
      });
      rl.close();

      if (answer !== 'y' && answer !== 'yes') {
        console.log('已取消');
        return;
      }
    }

    // 归档所有 PRD
    // Archive all PRDs
    for (const identifier of prdIdentifiers) {
      await archivePRD(projectRoot, identifier);
      console.log('');
    }

    console.log(`✅ 已归档 ${prdIdentifiers.length} 个 PRD`);
    return;
  }

  // 默认行为：列出可归档的 PRD
  // Default behavior: list archivable PRDs
  const prdIdentifiers = await listArchivablePRDs(projectRoot);

  if (prdIdentifiers.length === 0) {
    console.log('📋 没有找到可归档的 PRD');
    console.log('');
    console.log('使用方法:');
    console.log('  talos archive           # 列出可归档的 PRD');
    console.log('  talos archive --all     # 归档所有 PRD');
    console.log('  talos archive <id>      # 归档指定的 PRD');
    return;
  }

  console.log(`📋 可归档的 PRD (${prdIdentifiers.length} 个):`);
  prdIdentifiers.forEach(id => console.log(`   - ${id}`));
  console.log('');
  console.log('使用方法:');
  console.log('  talos archive --all     # 归档所有 PRD');
  console.log('  talos archive <id>      # 归档指定的 PRD');
}

/**
 * 创建 archive 命令
 * Create archive command
 */
export function createArchiveCommand(): Command {
  const cmd = new Command('archive')
    .description('归档已完成的 PRD / Archive completed PRDs')
    .option('--all', '归档所有 PRD / Archive all PRDs')
    .option('--force', '跳过确认提示 / Skip confirmation prompts')
    .argument('[identifier]', 'PRD 标识符 / PRD identifier')
    .action(async (identifier, options) => {
      if (identifier) {
        // 归档指定的 PRD - 需要先获取 repoRoot（通过 workspace 配置）
        const worktree = new GitWorktree(process.cwd());
        const listResult = await worktree.list();
        
        if (!listResult.success || !listResult.data || listResult.data.length === 0) {
          console.error('❌ 错误：无法获取仓库信息');
          process.exit(1);
        }
        
        const git = new GitRepository(process.cwd());
        const repoNameResult = await git.getRepoName();
        
        if (!repoNameResult.success || !repoNameResult.data) {
          console.error('❌ 错误：无法获取仓库名称');
          console.error(`Error: ${repoNameResult.error}`);
          process.exit(1);
        }
        
        const workspaceRepo = new WorkspaceRepository();
        const workspace = await workspaceRepo.findByName(repoNameResult.data);
        
        if (!workspace) {
          console.error(`❌ 错误：找不到 workspace 配置 (repoName: ${repoNameResult.data})`);
          process.exit(1);
        }
        
        const repoRoot = workspace.path;
        
        await archivePRD(repoRoot, identifier);
      } else {
        // 列出或归档所有
        // List or archive all
        await archiveCommand(options);
      }
    });

  return cmd;
}
