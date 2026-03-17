#!/usr/bin/env node
/**
 * 复制 assets 文件和 Ralph 脚本到 dist 目录
 */

import { copyFileSync, mkdirSync, existsSync, chmodSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);

// 定义需要复制的 assets 文件映射
const assetFiles = [
  { src: "src/assets/prd-generator.md", dest: "dist/assets/prd-generator.md" },
  { src: "src/assets/ralph-converter.md", dest: "dist/assets/ralph-converter.md" },
];

// 定义需要复制的 Ralph 脚本文件
const ralphFiles = [
  { src: "src/commands/run/ralph.sh", dest: "dist/commands/run/ralph.sh", executable: true },
  { src: "src/commands/run/log-wrapper.js", dest: "dist/commands/run/log-wrapper.js", executable: true },
  { src: "src/commands/run/CLAUDE.md", dest: "dist/commands/run/CLAUDE.md" },
  { src: "src/commands/run/cleanup-claude-orphans.sh", dest: "dist/commands/run/cleanup-claude-orphans.sh", executable: true },
];

// 复制 assets 文件
for (const { src, dest } of assetFiles) {
  const srcPath = join(rootDir, src);
  const destPath = join(rootDir, dest);

  if (!existsSync(srcPath)) {
    console.warn(`警告：源文件不存在 ${srcPath}`);
    continue;
  }

  // 确保目标目录存在
  const destDir = dirname(destPath);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // 复制文件
  copyFileSync(srcPath, destPath);
  console.log(`✓ 复制 ${src} → ${dest}`);
}

// 复制 Ralph 脚本文件
for (const { src, dest, executable } of ralphFiles) {
  const srcPath = join(rootDir, src);
  const destPath = join(rootDir, dest);

  if (!existsSync(srcPath)) {
    console.warn(`警告：源文件不存在 ${srcPath}`);
    continue;
  }

  // 确保目标目录存在
  const destDir = dirname(destPath);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // 复制文件
  copyFileSync(srcPath, destPath);

  // 如果是可执行文件，设置执行权限
  if (executable) {
    chmodSync(destPath, 0o755);
  }

  console.log(`✓ 复制 ${src} → ${dest}${executable ? ' (可执行)' : ''}`);
}

console.log("\nAssets 文件和 Ralph 脚本复制完成！");
