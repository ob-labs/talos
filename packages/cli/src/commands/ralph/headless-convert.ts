/**
 * Ralph Headless Converter
 *
 * 无头模式的 PRD 转换器
 * 读取 PRD 文件并转换为 Ralph 格式
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 读取并解析 PRD 文件
 */
export function readPRDFile(prdPath: string): { branchName?: string; content: string } {
  try {
    const content = readFileSync(prdPath, 'utf-8');
    
    // 尝试解析为 JSON
    try {
      const prdData = JSON.parse(content);
      return {
        branchName: prdData.branchName,
        content
      };
    } catch {
      // 不是 JSON，返回原始内容
      return {
        content
      };
    }
  } catch (error) {
    throw new Error(`Failed to read PRD file: ${prdPath}`);
  }
}

/**
 * 提取 PRD 标识符
 */
export function extractIdentifierFromPath(prdPath: string): string {
  const basename = prdPath.split('/').pop() || '';
  // 移除文件扩展名
  return basename.replace(/\.(json|md|txt)$/i, '');
}
