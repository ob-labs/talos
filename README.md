# Talos

管理 AI coding workflow 的 CLI 工具。

## 安装

```bash
npm install -g talos-cli
```

## 命令

### `talos list`

列出可用的 builtin workflows 和 agents。

```bash
talos list
```

输出示例：
```
Workflows:
  debug — Debug Pipeline
  issue2code — Issue2Code

Agents:
  debugger — 诊断并修复缺陷。
  executor — 实现新功能的代码。
  memorizer — 将知识沉淀到三层记忆。
  reviewer — 审查代码变更是否符合验收标准。
  tester — 端到端验证。
  tracker — 从 GitHub 同步 issues 到本地。
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

## 架构

```
talos/                          (package root)
├── agents/                     # Builtin 共享 agent 库
│   ├── debugger.md
│   ├── executor.md
│   ├── memorizer.md
│   ├── reviewer.md
│   ├── tester.md
│   └── tracker.md
├── workflows/
│   ├── debug/
│   │   ├── workflow.md         # 编排定义
│   │   └── manifest.json       # 配置：agents/skills/mcp/plugins 依赖 + memorize 配置
│   └── issue2code/
│       ├── workflow.md
│       └── manifest.json
├── skills/
│   ├── workflow/               # Workflow runner skill
│   │   ├── SKILL.md
│   │   └── memorize.md         # 记忆读写协议
│   └── workflow-creator/       # Workflow 创建引导 skill
```

### Agent

可复用的执行单元，定义在 `agents/` 目录。Workflow 通过 `manifest.json` 路径引用：
- `agents/xx` — 引用 builtin agent
- `./agents/xx` — 引用 workflow-local agent

### manifest.json

每个 workflow 的配置清单：

```json
{
  "memorize": true,
  "agents": ["agents/executor", "agents/reviewer"],
  "skills": [{ "name": "tdd", "source": "mattpocock/skills" }],
  "mcp": [{ "name": "server", "command": "npx", "args": ["pkg"] }],
  "plugins": ["plugin:figma:figma"]
}
```

- `memorize`：workflow 完成后是否写记忆（默认 true，false 则只读不写）
- `agents`：路径引用，builtin 或 local
- `skills`：从 skills.sh registry 下载
- `mcp`：内联配置或路径引用
- `plugins`：plugin ref 字符串

### 记忆

Workflow skill 内建行为，不需要在 workflow.md 中定义 stage：
- **执行前**：自动读取三层记忆（用户偏好、项目热记忆、知识库）
- **执行后**：如果 `memorize !== false`，自动委托 memorizer agent 沉淀知识

## 开发

```bash
npm install
npx tsx src/cli.ts list
npx tsx src/cli.ts install issue2code
```

## 发布

```bash
npm version patch   # 或 minor/major
git push --follow-tags
```

GitHub Actions 自动构建并发布到 npm。
