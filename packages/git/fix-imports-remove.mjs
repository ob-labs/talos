#!/usr/bin/env node
/**
 * 移除 Git 包中导入路径的 .js 扩展名
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, "src");

// 递归读取目录中的所有 .ts 文件
function getAllTsFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      getAllTsFiles(filePath, fileList);
    } else if (file.endsWith(".ts") && !file.endsWith(".test.ts")) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// 修复单个文件的导入路径
function fixImports(filePath) {
  let content = readFileSync(filePath, "utf-8");

  // 移除 from './xxx.js' 中的 .js 扩展名
  content = content.replace(
    /from\s+['"]\.\/([^'"]+)\.js['"]/g,
    (match, importPath) => {
      return `from './${importPath}'`;
    }
  );

  // 修复 export type 语句
  content = content.replace(
    /export\s+type\s+{[^}]+}\s+from\s+['"]\.\/([^'"]+)\.js['"]/g,
    (match, importPath) => {
      return match.replace(
        /from\s+['"]\.\/([^'"]+)\.js['"]/,
        `from './${importPath}'`
      );
    }
  );

  writeFileSync(filePath, content);
  console.log(`✓ 修复 ${filePath}`);
}

// 主函数
const tsFiles = getAllTsFiles(srcDir);
tsFiles.forEach(fixImports);

console.log(`\n修复了 ${tsFiles.length} 个文件的导入路径`);
