#!/usr/bin/env node
/**
 * talos help 命令
 * 显示命令使用信息和示例
 */

/**
 * 显示帮助信息
 */
export function helpCommand(): void {
  console.log(`
Talos CLI - AI 辅助开发工作流管理工具
========================================

命令列表:
  talos run              运行 Ralph 脚本，执行 PRD 中的用户故事
  talos ralph            通过 Claude Code 对话转换 PRD 为 Ralph 格式
  talos prd              通过 Claude Code 对话创建 PRD
  talos help             显示帮助信息

使用示例:
---------

# talos run - 运行 Ralph 脚本
  talos run

  # 指定特性分支
  talos run --feat <feature-name>

  说明：执行 ralph/<feature-name>/prd.json 中的用户故事
  前提：需要先运行 'talos ralph' 转换 PRD

# talos ralph - 通过 Claude Code 对话转换 PRD 为 Ralph 格式
  # 启动对话模式，Claude 会询问要转换哪个 PRD
  talos ralph

  # 直接指定要转换的 PRD
  talos ralph <prd-identifier>

  说明：Claude Code 会读取 PRD 并转换为 Ralph JSON 格式
       输出文件：ralph/<prd-identifier>/prd.json

# talos prd - 通过 Claude Code 对话创建 PRD
  # 启动对话模式，Claude 会引导你创建 PRD
  talos prd

  说明：Claude Code 会询问澄清问题并生成结构化 PRD
       PRD 文件保存在：tasks/prd-[feature-name].md

# talos help - 显示帮助信息
  talos help

  说明：显示所有命令的使用说明和示例

完整工作流程示例:
-----------------

# 1. 通过对话创建新的 PRD
talos prd

# 2. 通过对话转换 PRD 为 Ralph 格式
talos ralph <your-prd-identifier>

# 3. 运行 Ralph 执行用户故事
talos run

更多信息:
---------
- 项目仓库：https://github.com/yourusername/talos
- 问题反馈：https://github.com/yourusername/talos/issues
`);
}
