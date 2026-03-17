#!/usr/bin/env node
/**
 * 批量修复 Git 包中的导入路径，添加 .js 扩展名
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

  // 修复 from './xxx' 为 from './xxx.js'
  // 但排除：
  // 1. 已经有 .js 扩展名的
  // 2. 从 @talos/types 导入的
  // 3. 从 node_modules 导入的
  content = content.replace(
    /from\s+['"]\.(\/[^'"]+)['"](?!\.js')/g,
    (match, importPath) => {
      // 检查是否是相对导入且没有扩展名
      if (!importPath.endsWith(".js") && !importPath.endsWith(".ts")) {
        return `from './${importPath}.js'`;
      }
      return match;
    }
  );

  // 修复 export type 语句
  content = content.replace(
    /export\s+type\s+{[^}]+}\s+from\s+['"]\.(\/[^'"]+)['"](?!\.js')/g,
    (match, importPath) => {
      if (!importPath.endsWith(".js") && !importPath.endsWith(".ts")) {
        return match.replace(
          /from\s+['"]\.(\/[^'"]+)['"]/,
          `from './${importPath}.js'`
        );
      }
      return match;
    }
  );

  writeFileSync(filePath, content);
  console.log(`✓ 修复 ${filePath}`);
}

// 主函数
const tsFiles = getAllTsFiles(srcDir);
tsFiles.forEach(fixImports);

console.log(`\n修复了 ${tsFiles.length} 个文件的导入路径`);
