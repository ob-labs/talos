/**
 * Git 版本检查工具
 * Git Version Check Utilities
 */

import { execSync } from 'child_process';
import { ErrorMessages } from './errors';

/**
 * Git 版本信息
 */
export interface GitVersionInfo {
  full: string; // 完整版本字符串，如 "git version 2.39.0"
  major: number; // 主版本号
  minor: number; // 次版本号
  patch: number; // 补丁版本号
  valid: boolean; // 版本字符串是否有效
}

/**
 * 解析 Git 版本字符串
 * Parse Git version string
 *
 * @param versionString - git version 的输出，如 "git version 2.39.0"
 * @returns 解析后的版本信息
 *
 * @example
 * ```typescript
 * const info = parseGitVersion("git version 2.39.0");
 * // { full: "git version 2.39.0", major: 2, minor: 39, patch: 0, valid: true }
 * ```
 */
function parseGitVersion(versionString: string): GitVersionInfo {
  // 尝试匹配 "git version X.Y.Z" 格式
  const match = versionString.match(/git version (\d+)\.(\d+)\.(\d+)/);

  if (match) {
    return {
      full: versionString.trim(),
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      valid: true,
    };
  }

  // 格式不正确，返回无效版本
  return {
    full: versionString.trim(),
    major: 0,
    minor: 0,
    patch: 0,
    valid: false,
  };
}

/**
 * 检查 Git 版本是否满足最低要求
 * Check if Git version meets minimum requirement
 *
 * @param versionInfo - Git 版本信息
 * @param minMajor - 最低主版本号（默认 2）
 * @param minMinor - 最低次版本号（默认 5）
 * @returns 是否满足要求
 *
 * @example
 * ```typescript
 * const info = parseGitVersion("git version 2.39.0");
 * checkGitVersion(info, 2, 5); // true (2.39.0 >= 2.5.0)
 * ```
 */
function checkVersionRequirement(
  versionInfo: GitVersionInfo,
  minMajor: number = 2,
  minMinor: number = 5
): boolean {
  if (!versionInfo.valid) {
    return false;
  }

  // 主版本号必须匹配
  if (versionInfo.major !== minMajor) {
    return versionInfo.major > minMajor;
  }

  // 次版本号必须大于等于最低要求
  return versionInfo.minor >= minMinor;
}

/**
 * 检查 Git 版本是否 >= 2.5
 * Check if Git version is >= 2.5
 *
 * Git worktree 功能需要 Git 2.5+ 才能正常工作。
 * Git worktree feature requires Git 2.5 or higher.
 *
 * @returns true 如果 Git >= 2.5，false 否则
 *
 * @example
 * ```typescript
 * const isSupported = checkGitVersion();
 * if (!isSupported) {
 *   console.error(ErrorMessages.GIT_VERSION_TOO_OLD(currentVersion));
 * }
 * ```
 */
export function checkGitVersion(): boolean {
  try {
    // 执行 git version 命令
    const versionOutput = execSync('git version', { encoding: 'utf-8' });

    // 解析版本信息
    const versionInfo = parseGitVersion(versionOutput);

    // 检查是否满足 Git 2.5+
    return checkVersionRequirement(versionInfo, 2, 5);
  } catch (error) {
    // 执行失败，假设 Git 未安装或版本过低
    return false;
  }
}

