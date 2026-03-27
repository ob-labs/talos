#!/bin/bash

# Talos CLI 功能测试脚本

echo "🧪 测试 Talos CLI 功能"
echo "===================="
echo ""

# 检查是否已构建
if [ ! -f "packages/cli/dist/index.js" ]; then
    echo "❌ 构建文件不存在，正在构建..."
    pnpm --filter talos-cli build
    echo ""
fi

echo "1️⃣ 测试版本功能（长选项）"
echo "命令: node packages/cli/dist/index.js --version"
node packages/cli/dist/index.js --version
echo ""

echo "2️⃣ 测试版本功能（短选项）"
echo "命令: node packages/cli/dist/index.js -V"
node packages/cli/dist/index.js -V
echo ""

echo "3️⃣ 测试更新检查功能"
echo "命令: node packages/cli/dist/index.js update --check"
node packages/cli/dist/index.js update --check
echo ""

echo "4️⃣ 测试更新命令帮助"
echo "命令: node packages/cli/dist/index.js update --help"
node packages/cli/dist/index.js update --help
echo ""

echo "✅ 基础功能测试完成！"
echo ""
echo "📋 更多测试选项："
echo "   - 全局测试: pnpm link --global (在 packages/cli 目录下)"
echo "   - 完整安装: pnpm install --global ./packages/cli"
echo "   - 取消链接: pnpm unlink --global"
