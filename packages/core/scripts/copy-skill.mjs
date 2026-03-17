#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Copy skill.md from assets/ to dist/task-manager/
const sourcePath = join(__dirname, "../assets/skill.md");
const targetDir = join(__dirname, "../dist/task-manager");
const targetPath = join(targetDir, "skill.md");

if (!existsSync(sourcePath)) {
  console.log("⚠️  skill.md 源文件不存在，跳过复制");
  console.log(`   期望路径: ${sourcePath}`);
  process.exit(0);
}

// Ensure target directory exists
mkdirSync(targetDir, { recursive: true });

// Copy file
const content = readFileSync(sourcePath, "utf-8");
writeFileSync(targetPath, content, "utf-8");

console.log("✓ 复制 skill.md → dist/task-manager/skill.md");
