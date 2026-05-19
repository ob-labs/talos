# Talos Workspace

管理 AI coding workflow 的 CLI 工具。

## 安装

```bash
npm install -g talos
```

## 命令

### `talos list`

列出可用的 builtin workflows。

```bash
talos list
```

输出示例：
```
  issue2code — Issue2Code
```

### `talos install [name]`

安装 workflow 到当前目录。

```bash
# 交互选择并安装
talos install

# 安装指定的 builtin workflow
talos install issue2code
```

安装过程会：
1. 同步 agents 到 `.claude/agents/`
2. 安装 skills 到 `.claude/skills/`
3. 配置 MCP servers 和 plugins
4. 复制 workflow.md 到 `.workflows/<name>/`

安装完成后，在 Claude Code 中运行 `/workflow <name>` 开始使用。

### `talos install --source <source> [name]`

从外部源安装 workflow（本地路径或 git repo）。

```bash
# 从本地目录安装（交互选择）
talos install --source /path/to/workflow

# 从本地目录安装指定 workflow
talos install my-flow --source /path/to/workflow

# 从 git repo 安装
talos install --source https://github.com/org/workflows.git
```

### `talos graph`

启动 web dashboard 查看会话执行图。

```bash
talos graph
```

默认端口 3456，可通过 `--port` 指定。

## Workflow 结构

每个 workflow 包含：

```
workflow/
├── workflow.md      # 必需：workflow 定义
├── agents/          # 可选：agent 定义文件
├── skills.json      # 可选：依赖的 skills
└── mcp.json         # 可选：MCP servers 和 plugins
```

## 开发

```bash
npm install
npx tsx src/cli.ts list
npx tsx src/cli.ts install issue2code /path/to/target-repo
```
