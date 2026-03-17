/**
 * Ralph 工具函数单元测试
 * Ralph Utility Functions Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getUncommittedPRDs, extractPRDIdentifier, isPRDConverted, archiveCurrentPRD, getRalphDirectoryPath, ensureRalphDirectories, selectPRDFromList, scanRalphDirectories } from './utils.js';
import { readdir, stat, readFile, mkdir, copyFile, writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { mkdirSync } from 'fs';
import { createInterface } from 'readline';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  mkdirSync: vi.fn(),
}));

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock readline
vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

// Type definitions for mocks
type MockExec = {
  (command: string, options: any, callback: (error: Error | null, stdout: string, stderr: string) => void): any;
  (command: string, callback: (error: Error | null, stdout: string, stderr: string) => void): any;
};

describe('extractPRDIdentifier', () => {
  it('应从标准格式的文件名中提取标识符', () => {
    // Arrange & Act
    const result = extractPRDIdentifier('prd-talos-cli.md');

    // Assert
    expect(result).toBe('talos-cli');
  });

  it('应处理包含多个连字符的文件名', () => {
    // Arrange & Act
    const result = extractPRDIdentifier('prd-cli-prd-anywhere.md');

    // Assert
    expect(result).toBe('cli-prd-anywhere');
  });

  it('应处理单个标识符的文件名', () => {
    // Arrange & Act
    const result = extractPRDIdentifier('prd-test.md');

    // Assert
    expect(result).toBe('test');
  });

  it('应处理包含数字的文件名', () => {
    // Arrange & Act
    const result = extractPRDIdentifier('prd-feature-123.md');

    // Assert
    expect(result).toBe('feature-123');
  });

  it('如果文件名缺少 prd- 前缀，应抛出错误', () => {
    // Arrange & Act & Assert
    expect(() => extractPRDIdentifier('talos-cli.md')).toThrow(
      '无效的 PRD 文件名格式: "talos-cli.md"。期望格式: "prd-<identifier>.md"'
    );
  });

  it('如果文件名缺少 .md 扩展名，应抛出错误', () => {
    // Arrange & Act & Assert
    expect(() => extractPRDIdentifier('prd-talos-cli')).toThrow(
      '无效的 PRD 文件名格式: "prd-talos-cli"。期望格式: "prd-<identifier>.md"'
    );
  });

  it('如果文件名只有 prd- 前缀没有标识符，应抛出错误', () => {
    // Arrange & Act & Assert
    expect(() => extractPRDIdentifier('prd-.md')).toThrow(
      '无效的 PRD 文件名格式: "prd-.md"。期望格式: "prd-<identifier>.md"'
    );
  });

  it('如果文件名为空字符串，应抛出错误', () => {
    // Arrange & Act & Assert
    expect(() => extractPRDIdentifier('')).toThrow(
      '无效的 PRD 文件名格式: ""。期望格式: "prd-<identifier>.md"'
    );
  });
});

describe('getUncommittedPRDs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('如果 tasks/ 目录不存在，应返回空数组', async () => {
    // Arrange
    vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

    // Act
    const result = await getUncommittedPRDs('/path/to/project');

    // Assert
    expect(result).toEqual([] as any);
  });

  it('如果没有 PRD 文件，应返回空数组', async () => {
    // Arrange
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(readdir).mockResolvedValue(['other-file.txt', 'readme.md'] as any);

    // Act
    const result = await getUncommittedPRDs('/path/to/project');

    // Assert
    expect(result).toEqual([] as any);
  });

  it('应识别未提交的 PRD 文件', async () => {
    // Arrange
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(readdir).mockResolvedValue([
      'prd-feature-one.md',
      'prd-feature-two.md',
      'readme.md',
    ] as any);

    // Mock git status output
    const mockExec = vi.mocked(exec as MockExec);
    mockExec.mockImplementation((command: string, optionsOrCallback: any, callback?: any) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      if (typeof cb === 'function') {
        cb(null, ' M tasks/prd-feature-one.md\n?? tasks/prd-feature-two.md', '');
      }
      return {} as any;
    });

    // Act
    const result = await getUncommittedPRDs('/path/to/project');

    // Assert
    expect(result).toContain('prd-feature-one.md');
    expect(result).toContain('prd-feature-two.md');
    expect(result).toHaveLength(2);
  });

  it('应过滤已提交的 PRD 文件', async () => {
    // Arrange
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(readdir).mockResolvedValue([
      'prd-committed.md',
      'prd-uncommitted.md',
    ] as any);

    // Mock git status output - 只有 prd-uncommitted.md 是未提交的
    const mockExec = vi.mocked(exec as MockExec);
    mockExec.mockImplementation((command: string, optionsOrCallback: any, callback?: any) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      if (typeof cb === 'function') {
        cb(null, ' M tasks/prd-uncommitted.md', '');
      }
      return {} as any;
    });

    // Act
    const result = await getUncommittedPRDs('/path/to/project');

    // Assert
    expect(result).not.toContain('prd-committed.md');
    expect(result).toContain('prd-uncommitted.md');
    expect(result).toHaveLength(1);
  });
});

describe('isPRDConverted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('如果 archive/ 目录不存在，应返回 false', async () => {
    // Arrange
    vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

    // Act
    const result = await isPRDConverted('/path/to/project', 'talos-cli');

    // Assert
    expect(result).toBe(false);
  });

  it('如果 archive/ 目录读取失败，应返回 false', async () => {
    // Arrange
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(readdir).mockRejectedValue(new Error('Permission denied'));

    // Act
    const result = await isPRDConverted('/path/to/project', 'talos-cli');

    // Assert
    expect(result).toBe(false);
  });

  it('如果 archive/ 目录为空，应返回 false', async () => {
    // Arrange
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi.mocked(readdir).mockResolvedValue([] as any);

    // Act
    const result = await isPRDConverted('/path/to/project', 'talos-cli');

    // Assert
    expect(result).toBe(false);
  });

  it('应识别匹配的归档目录', async () => {
    // Arrange
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive/ directory
      .mockResolvedValueOnce({ isDirectory: () => true } as any); // archive/2026-03-02-talos-cli/

    vi.mocked(readdir).mockResolvedValue(['2026-03-02-talos-cli'] as any);

    // Act
    const result = await isPRDConverted('/path/to/project', 'talos-cli');

    // Assert
    expect(result).toBe(true);
  });

  it('应识别不同日期的匹配归档目录', async () => {
    // Arrange
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive/ directory
      .mockResolvedValueOnce({ isDirectory: () => true } as any); // archive/2026-02-24-talos-cli/

    vi.mocked(readdir).mockResolvedValue([
      '2026-02-27-terminal-centric',
      '2026-02-24-talos-cli',
      '2026-03-01-worktree-sync',
    ] as any);

    // Act
    const result = await isPRDConverted('/path/to/project', 'talos-cli');

    // Assert
    expect(result).toBe(true);
  });

  it('如果不存在匹配的归档目录，应返回 false', async () => {
    // Arrange
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive/ directory
      .mockResolvedValue({ isDirectory: () => true } as any); // subdirectories

    vi.mocked(readdir).mockResolvedValue([
      '2026-02-27-terminal-centric',
      '2026-03-01-worktree-sync',
    ] as any);

    // Act
    const result = await isPRDConverted('/path/to/project', 'talos-cli');

    // Assert
    expect(result).toBe(false);
  });

  it('应忽略非目录条目', async () => {
    // Arrange
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive/ directory
      .mockRejectedValue(new Error('Not a directory')); // archive/2026-03-02-talos-cli is not a directory

    vi.mocked(readdir).mockResolvedValue(['2026-03-02-talos-cli', 'some-file.txt'] as any);

    // Act
    const result = await isPRDConverted('/path/to/project', 'talos-cli');

    // Assert
    expect(result).toBe(false);
  });

  it('应正确处理带连字符的标识符', async () => {
    // Arrange
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive/ directory
      .mockResolvedValueOnce({ isDirectory: () => true } as any); // archive/2026-03-02-cli-prd-anywhere/

    vi.mocked(readdir).mockResolvedValue(['2026-03-02-cli-prd-anywhere'] as any);

    // Act
    const result = await isPRDConverted('/path/to/project', 'cli-prd-anywhere');

    // Assert
    expect(result).toBe(true);
  });

  it('应只匹配完整标识符（不部分匹配）', async () => {
    // Arrange
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // archive/ directory
      .mockResolvedValue({ isDirectory: () => true } as any); // subdirectories

    vi.mocked(readdir).mockResolvedValue([
      '2026-03-02-cli-ralph-intelligent',
      '2026-03-02-cli-prd-anywhere',
    ] as any);

    // Act & Assert - 查找 'cli' 应该不匹配 'cli-ralph-intelligent' 或 'cli-prd-anywhere'
    const result = await isPRDConverted('/path/to/project', 'cli');

    // Assert
    expect(result).toBe(false);
  });
});

describe('archiveCurrentPRD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('如果 ralph/ 目录不存在，应直接返回', async () => {
    // Arrange
    vi.mocked(readdir).mockRejectedValue(new Error('Directory not found'));

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
  });

  it('如果 ralph/ 目录为空，应直接返回', async () => {
    // Arrange
    vi.mocked(readdir).mockResolvedValue([] as any);

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
  });

  it('如果 ralph/ 目录中没有 prd.json，应直接返回', async () => {
    // Arrange
    vi.mocked(readdir).mockResolvedValue(['some-dir'] as any);
    vi.mocked(stat).mockRejectedValue(new Error('File not found'));

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(readFile)).not.toHaveBeenCalled();
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
  });

  it('如果 prd.json 读取失败，应直接返回', async () => {
    // Arrange
    vi.mocked(readdir).mockResolvedValue(['cli-ralph-intelligent'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // cli-ralph-intelligent is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any); // prd.json exists
    vi.mocked(readFile).mockRejectedValue(new Error('Read error'));

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
  });

  it('如果 prd.json 解析失败，应直接返回', async () => {
    // Arrange
    vi.mocked(readdir).mockResolvedValue(['cli-ralph-intelligent'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // cli-ralph-intelligent is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any); // prd.json exists
    vi.mocked(readFile).mockResolvedValue('invalid json {{{');

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
  });

  it('如果 prd.json 没有 branchName 字段，应直接返回', async () => {
    // Arrange
    vi.mocked(readdir).mockResolvedValue(['cli-ralph-intelligent'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // cli-ralph-intelligent is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any); // prd.json exists
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ project: 'test' }));

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
  });

  it('应创建归档目录并复制文件', async () => {
    // Arrange
    const mockPrdContent = JSON.stringify({
      branchName: 'ralph/cli-ralph-intelligent',
      project: 'test',
    });
    vi.mocked(readdir).mockResolvedValue(['cli-ralph-intelligent'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // cli-ralph-intelligent is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any) // prd.json exists
      .mockResolvedValueOnce({ isDirectory: () => false } as any); // progress.txt exists
    vi.mocked(readFile).mockResolvedValue(mockPrdContent);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(copyFile).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
      '/path/to/project/archive/cli-ralph-intelligent-2026-03-05',
      { recursive: true }
    );
    expect(vi.mocked(copyFile)).toHaveBeenCalledWith(
      '/path/to/project/ralph/cli-ralph-intelligent/prd.json',
      '/path/to/project/archive/cli-ralph-intelligent-2026-03-05/prd.json'
    );
    expect(vi.mocked(copyFile)).toHaveBeenCalledWith(
      '/path/to/project/ralph/cli-ralph-intelligent/progress.txt',
      '/path/to/project/archive/cli-ralph-intelligent-2026-03-05/progress.txt'
    );
    expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
      '/path/to/project/ralph/cli-ralph-intelligent/progress.txt',
      expect.stringContaining('# Ralph Progress Log\nStarted:'), 'utf-8'
    );
  });

  it('应使用目录名作为标识符创建归档目录', async () => {
    // Arrange
    const mockPrdContent = JSON.stringify({
      branchName: 'ralph/talos-cli',
      project: 'test',
    });
    vi.mocked(readdir).mockResolvedValue(['talos-cli'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // talos-cli is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any) // prd.json exists
      .mockRejectedValueOnce(new Error('not found')); // progress.txt doesn't exist
    vi.mocked(readFile).mockResolvedValue(mockPrdContent);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(copyFile).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
      '/path/to/project/archive/talos-cli-2026-03-05',
      { recursive: true }
    );
    expect(vi.mocked(copyFile)).toHaveBeenCalledTimes(1); // Only prd.json, not progress.txt
  });

  it('如果 progress.txt 不存在，应跳过复制', async () => {
    // Arrange
    const mockPrdContent = JSON.stringify({
      branchName: 'ralph/test-prd',
      project: 'test',
    });
    vi.mocked(readdir).mockResolvedValue(['test-prd'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // test-prd is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any) // prd.json exists
      .mockRejectedValueOnce(new Error('File not found')); // progress.txt doesn't exist
    vi.mocked(readFile).mockResolvedValue(mockPrdContent);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(copyFile).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(copyFile)).toHaveBeenCalledTimes(1); // Only prd.json
    expect(vi.mocked(copyFile)).toHaveBeenCalledWith(
      '/path/to/project/ralph/test-prd/prd.json',
      '/path/to/project/archive/test-prd-2026-03-05/prd.json'
    );
  });

  it('应重置 progress.txt 为新的 header', async () => {
    // Arrange
    const mockPrdContent = JSON.stringify({
      branchName: 'ralph/test',
      project: 'test',
    });
    vi.mocked(readdir).mockResolvedValue(['test'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // test is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any) // prd.json exists
      .mockResolvedValueOnce({ isDirectory: () => false } as any); // progress.txt exists
    vi.mocked(readFile).mockResolvedValue(mockPrdContent);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(copyFile).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(writeFile)).toHaveBeenCalledWith(
      '/path/to/project/ralph/test/progress.txt',
      expect.stringMatching(/^# Ralph Progress Log\nStarted: .*?\n---\n$/), 'utf-8'
    );
  });

  it('如果归档过程中出错，应抛出错误', async () => {
    // Arrange
    const mockPrdContent = JSON.stringify({
      branchName: 'ralph/test',
      project: 'test',
    });
    vi.mocked(readdir).mockResolvedValue(['test'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // test is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any); // prd.json exists
    vi.mocked(readFile).mockResolvedValue(mockPrdContent);
    vi.mocked(mkdir).mockRejectedValue(new Error('Permission denied'));

    // Act & Assert
    await expect(archiveCurrentPRD('/path/to/project')).rejects.toThrow('归档 PRD 失败: Permission denied');
  });

  it('应使用新目录路径 ralph/{name}/ 进行归档', async () => {
    // Arrange
    const mockPrdContent = JSON.stringify({
      branchName: 'ralph/feature-name',
      project: 'test',
    });
    vi.mocked(readdir).mockResolvedValue(['feature-name'] as any);
    vi.mocked(stat)
      .mockResolvedValueOnce({ isDirectory: () => true } as any) // feature-name is directory
      .mockResolvedValueOnce({ isDirectory: () => false } as any) // prd.json exists
      .mockResolvedValueOnce({ isDirectory: () => false } as any); // progress.txt exists
    vi.mocked(readFile).mockResolvedValue(mockPrdContent);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(copyFile).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    // Act
    await archiveCurrentPRD('/path/to/project');

    // Assert
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(
      '/path/to/project/archive/feature-name-2026-03-05',
      { recursive: true }
    );
    expect(vi.mocked(copyFile)).toHaveBeenCalledWith(
      '/path/to/project/ralph/feature-name/prd.json',
      '/path/to/project/archive/feature-name-2026-03-05/prd.json'
    );
  });
});

describe('getRalphDirectoryPath', () => {
  it('应返回正确的 Ralph 目录路径', () => {
    // Arrange & Act
    const result = getRalphDirectoryPath('/path/to/project', 'talos-cli');

    // Assert
    expect(result).toBe('/path/to/project/ralph/talos-cli');
  });

  it('应处理带多个连字符的标识符', () => {
    // Arrange & Act
    const result = getRalphDirectoryPath('/path/to/project', 'cli-prd-anywhere');

    // Assert
    expect(result).toBe('/path/to/project/ralph/cli-prd-anywhere');
  });

  it('应处理单个标识符', () => {
    // Arrange & Act
    const result = getRalphDirectoryPath('/path/to/project', 'test');

    // Assert
    expect(result).toBe('/path/to/project/ralph/test');
  });

  it('应处理包含数字的标识符', () => {
    // Arrange & Act
    const result = getRalphDirectoryPath('/path/to/project', 'feature-123');

    // Assert
    expect(result).toBe('/path/to/project/ralph/feature-123');
  });

  it('应使用路径分隔符正确拼接路径', () => {
    // Arrange & Act
    const result = getRalphDirectoryPath('/Users/john/projects/my-app', 'my-feature');

    // Assert
    expect(result).toBe('/Users/john/projects/my-app/ralph/my-feature');
  });

  it('应处理项目根目录不带尾部斜杠', () => {
    // Arrange & Act
    const result = getRalphDirectoryPath('/path/to/project', 'identifier');

    // Assert
    expect(result).toBe('/path/to/project/ralph/identifier');
  });

  it('应处理标识符中包含连字符', () => {
    // Arrange & Act
    const result = getRalphDirectoryPath('/path/to/project', 'cli-ralph-intelligent-detection');

    // Assert
    expect(result).toBe('/path/to/project/ralph/cli-ralph-intelligent-detection');
  });
});

describe('ensureRalphDirectories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应创建 ralph/{identifier}/ 目录', () => {
    // Arrange
    const mockMkdirSync = vi.mocked(mkdirSync);
    mockMkdirSync.mockReturnValue(undefined);

    // Act
    ensureRalphDirectories('/path/to/project/ralph/talos-cli');

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith(
      '/path/to/project/ralph/talos-cli',
      { recursive: true }
    );
  });

  it('应处理带多个连字符的标识符', () => {
    // Arrange
    const mockMkdirSync = vi.mocked(mkdirSync);
    mockMkdirSync.mockReturnValue(undefined);

    // Act
    ensureRalphDirectories('/path/to/project/ralph/cli-prd-anywhere');

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith(
      '/path/to/project/ralph/cli-prd-anywhere',
      { recursive: true }
    );
  });

  it('应处理单个标识符', () => {
    // Arrange
    const mockMkdirSync = vi.mocked(mkdirSync);
    mockMkdirSync.mockReturnValue(undefined);

    // Act
    ensureRalphDirectories('/path/to/project/ralph/test');

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith(
      '/path/to/project/ralph/test',
      { recursive: true }
    );
  });

  it('应使用路径分隔符正确拼接路径', () => {
    // Arrange
    const mockMkdirSync = vi.mocked(mkdirSync);
    mockMkdirSync.mockReturnValue(undefined);

    // Act
    ensureRalphDirectories('/Users/john/projects/my-app/ralph/my-feature');

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith(
      '/Users/john/projects/my-app/ralph/my-feature',
      { recursive: true }
    );
  });

  it('应使用 { recursive: true } 选项创建目录', () => {
    // Arrange
    const mockMkdirSync = vi.mocked(mkdirSync);
    mockMkdirSync.mockReturnValue(undefined);

    // Act
    ensureRalphDirectories('/path/to/project/ralph/test');

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true }
    );
  });

  it('应处理 Ralph 目录路径不带尾部斜杠', () => {
    // Arrange
    const mockMkdirSync = vi.mocked(mkdirSync);
    mockMkdirSync.mockReturnValue(undefined);

    // Act
    ensureRalphDirectories('/path/to/project/ralph/identifier');

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith(
      '/path/to/project/ralph/identifier',
      { recursive: true }
    );
  });
});

describe('selectPRDFromList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应显示编号列表并让用户选择', async () => {
    // Arrange
    const prdFiles = ['prd-talos-cli.md', 'prd-new-feature.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn(),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Mock user input: 选择第1个
    mockQuestion.mockImplementation((prompt, callback) => {
      callback('1');
    });

    // Act
    const result = await selectPRDFromList(prdFiles);

    // Assert
    expect(result).toBe('prd-talos-cli.md');
    expect(mockQuestion).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('应支持输入编号选择 PRD', async () => {
    // Arrange
    const prdFiles = ['prd-feature-a.md', 'prd-feature-b.md', 'prd-feature-c.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn(),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Mock user input: 选择第2个
    mockQuestion.mockImplementation((prompt, callback) => {
      callback('2');
    });

    // Act
    const result = await selectPRDFromList(prdFiles);

    // Assert
    expect(result).toBe('prd-feature-b.md');
  });

  it('应支持输入文件名选择 PRD', async () => {
    // Arrange
    const prdFiles = ['prd-feature-a.md', 'prd-feature-b.md', 'prd-feature-c.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn(),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Mock user input: 直接输入文件名
    mockQuestion.mockImplementation((prompt, callback) => {
      callback('prd-feature-c.md');
    });

    // Act
    const result = await selectPRDFromList(prdFiles);

    // Assert
    expect(result).toBe('prd-feature-c.md');
  });

  it('应对无效的编号抛出错误', async () => {
    // Arrange
    const prdFiles = ['prd-feature-a.md', 'prd-feature-b.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn(),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Mock user input: 无效编号
    mockQuestion.mockImplementation((prompt, callback) => {
      callback('5');
    });

    // Act & Assert
    await expect(selectPRDFromList(prdFiles)).rejects.toThrow(
      '无效的编号: 5。请输入 1 到 2 之间的数字。'
    );
  });

  it('应对无效的输入抛出错误', async () => {
    // Arrange
    const prdFiles = ['prd-feature-a.md', 'prd-feature-b.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn(),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Mock user input: 无效输入
    mockQuestion.mockImplementation((prompt, callback) => {
      callback('invalid-input');
    });

    // Act & Assert
    await expect(selectPRDFromList(prdFiles)).rejects.toThrow(
      '无效的输入: "invalid-input"。请输入 1 到 2 之间的编号或完整的文件名。'
    );
  });

  it('应处理空输入', async () => {
    // Arrange
    const prdFiles = ['prd-feature-a.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn(),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Mock user input: 空字符串
    mockQuestion.mockImplementation((prompt, callback) => {
      callback('');
    });

    // Act & Assert
    await expect(selectPRDFromList(prdFiles)).rejects.toThrow(
      '无效的输入: ""。请输入 1 到 1 之间的编号或完整的文件名。'
    );
  });

  it('应处理用户按 Ctrl+C 取消', async () => {
    // Arrange
    const prdFiles = ['prd-feature-a.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn((event, handler) => {
        // 立即触发 SIGINT 事件
        if (event === 'SIGINT') {
          handler();
        }
      }),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Act & Assert
    await expect(selectPRDFromList(prdFiles)).rejects.toThrow('用户取消操作 / User cancelled');
  });

  it('应处理包含多个连字符的文件名', async () => {
    // Arrange
    const prdFiles = ['prd-cli-ralph-intelligent-detection.md', 'prd-talos-cli.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn(),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Mock user input: 直接输入带多个连字符的文件名
    mockQuestion.mockImplementation((prompt, callback) => {
      callback('prd-cli-ralph-intelligent-detection.md');
    });

    // Act
    const result = await selectPRDFromList(prdFiles);

    // Assert
    expect(result).toBe('prd-cli-ralph-intelligent-detection.md');
  });

  it('应确保 readline 接口被关闭', async () => {
    // Arrange
    const prdFiles = ['prd-test.md'];
    const mockQuestion = vi.fn();
    const mockClose = vi.fn();
    const mockRl = {
      question: mockQuestion,
      close: mockClose,
      on: vi.fn(),
    };

    vi.mocked(createInterface).mockReturnValue(mockRl as any);

    // Mock user input
    mockQuestion.mockImplementation((prompt, callback) => {
      callback('1');
    });

    // Act
    await selectPRDFromList(prdFiles);

    // Assert
    expect(mockClose).toHaveBeenCalled();
  });
});

describe('scanRalphDirectories', () => {
  it('如果 ralph/ 目录不存在，应返回空数组', async () => {
    // Arrange
    const projectRoot = '/path/to/project';
    vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'));

    // Act
    const result = await scanRalphDirectories(projectRoot);

    // Assert
    expect(result).toEqual([]);
  });

  it('如果 ralph/ 目录为空，应返回空数组', async () => {
    // Arrange
    const projectRoot = '/path/to/project';
    vi.mocked(readdir).mockResolvedValue([] as any);

    // Act
    const result = await scanRalphDirectories(projectRoot);

    // Assert
    expect(result).toEqual([]);
  });

  it('应识别包含 prd.json 的子目录', async () => {
    // Arrange
    const projectRoot = '/path/to/project';
    vi.mocked(readdir).mockResolvedValue(['cli-ralph-intelligent', 'other-dir', 'test-prd'] as any);

    let callCount = 0;
    vi.mocked(stat).mockImplementation((path) => {
      const pathStr = path as string;
      callCount++;
      // Call pattern: 3 directory checks, then 3 prd.json checks
      if (callCount <= 3) {
        // Directory stat calls - all are directories
        return Promise.resolve({ isDirectory: () => true } as any);
      } else {
        // prd.json stat calls - cli-ralph-intelligent (4) and test-prd (6) have prd.json, other-dir (5) doesn't
        if (callCount === 4 || callCount === 6) {
          return Promise.resolve({ isDirectory: () => false } as any);
        }
        return Promise.reject(new Error('ENOENT'));
      }
    });

    // Act
    const result = await scanRalphDirectories(projectRoot);

    // Assert
    expect(result).toEqual(['cli-ralph-intelligent', 'test-prd']);
  });

  it('应忽略不包含 prd.json 的子目录', async () => {
    // Arrange
    const projectRoot = '/path/to/project';
    vi.mocked(readdir).mockResolvedValue(['with-prd', 'without-prd'] as any);

    let callCount = 0;
    vi.mocked(stat).mockImplementation((path) => {
      const pathStr = path as string;
      callCount++;
      if (callCount <= 2) {
        // Directory stat calls - both are directories
        return Promise.resolve({ isDirectory: () => true } as any);
      } else {
        // prd.json stat calls - only with-prd has prd.json
        if (callCount === 3) {
          return Promise.resolve({ isDirectory: () => false } as any);
        }
        return Promise.reject(new Error('ENOENT'));
      }
    });

    // Act
    const result = await scanRalphDirectories(projectRoot);

    // Assert
    expect(result).toEqual(['with-prd']);
  });

  it('应处理读取错误，返回空数组', async () => {
    // Arrange
    const projectRoot = '/path/to/project';
    vi.mocked(readdir).mockRejectedValue(new Error('Permission denied'));

    // Act
    const result = await scanRalphDirectories(projectRoot);

    // Assert
    expect(result).toEqual([]);
  });
});
