#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, "../dist");

if (!existsSync(distDir)) {
  console.log("dist 目录不存在，跳过修复");
  process.exit(0);
}

function fixImportsInFile(filePath) {
  let content = readFileSync(filePath, "utf-8");
  let modified = false;

  // 匹配 import 和 export from 语句中的路径
  // 支持: import { X } from '...', export { X } from '...', export * from '...', export * as X from '...'
  const singleQuoteRegex = /(?:import|export)\s+(?:\{[^}]*\}|\*\s*(?:\s+as\s+\w+)?|\w+)\s+from\s+'([^']+)'/g;
  const doubleQuoteRegex = /(?:import|export)\s+(?:\{[^}]*\}|\*\s*(?:\s+as\s+\w+)?|\w+)\s+from\s+"([^"]+)"/g;

  content = content.replace(singleQuoteRegex, (match, importPath) => {
    if (!importPath.startsWith("./") && !importPath.startsWith("../")) return match;
    if (importPath.endsWith(".js") || importPath.endsWith(".json")) return match;
    modified = true;
    return match.replace(importPath, importPath + ".js");
  });

  content = content.replace(doubleQuoteRegex, (match, importPath) => {
    if (!importPath.startsWith("./") && !importPath.startsWith("../")) return match;
    if (importPath.endsWith(".js") || importPath.endsWith(".json")) return match;
    modified = true;
    return match.replace(importPath, importPath + ".js");
  });

  if (modified) {
    writeFileSync(filePath, content);
    return true;
  }
  return false;
}

function fixDirectory(dir) {
  const files = readdirSync(dir, { withFileTypes: true });
  let fixedCount = 0;

  for (const file of files) {
    const fullPath = join(dir, file.name);
    if (file.isDirectory()) {
      fixedCount += fixDirectory(fullPath);
    } else if (file.name.endsWith(".js") && !file.name.endsWith(".map")) {
      if (fixImportsInFile(fullPath)) fixedCount++;
    }
  }
  return fixedCount;
}

const count = fixDirectory(distDir);
console.log(`✓ 已修复 ${count} 个文件的导入路径`);
