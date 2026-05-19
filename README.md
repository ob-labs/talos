# Talos

管理 AI coding workflow 的 CLI 工具。

## 命令

```bash
# 列出可用的 workflows
talos list

# 安装 workflow 到目标仓库
talos install [workflow] [target]
```

- `workflow` 默认 `issue2code`
- `target` 省略时从 `.env` 读 `TARGET_REPO`

## Workflow 结构

每个 workflow 是 `workflows/<name>/` 下的自包含目录：

- `workflow.md` — 编排定义（stages、协调规则）
- `skills.json` — skill registry 来源声明
- `mcp.json` — MCP servers 和 plugins 依赖声明
- `agents/` — agent 定义文件

## 开发

```bash
npm install
npx tsx src/cli.ts list
npx tsx src/cli.ts install issue2code /path/to/target-repo
```
