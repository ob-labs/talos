# Talos

Talos 是一个基于自然语言实现的 harness workflow 编排器，你只需要去描述 workflow 的步骤，借助 coding agent 提供的 subagent，你可以在一个会话完成一个长链路任务的执行。 

## Quick Start

**1. 安装 CLI**

```bash
npm install -g talos-cli
```

**2. 安装 Workflow**

```bash
talos install issue2code
```

**3. 运行 Workflow**

```bash
claude --dangerously-skip-permissions
# claude code：
# /workflow issue2code https://github.com/ob-labs/talos/issues/xx
```

在 Claude Code 中输入 `/workflow` 开始使用。

### 内置 Workflows

| 名称 | 用途 |
|------|------|
| `issue2code` | 从需求到代码的完整流程：同步 issue → PRD → 拆分 → 实现 → 审查 → E2E 验证 |
| `debug` | 缺陷诊断与修复：理解缺陷 → 调试循环 → 审查 |

## 架构

![Talos Architecture](docs/architecture.png)

### Talos vs 传统 Workflow 平台

传统 workflow 平台（如 Dify）采用确定性编排：每个节点是一个明确的函数调用，流程严格执行预定义路径。

Talos 是 coding agent 的 harness。通过自然语言编排文件（workflow.md）约束 agent 如何运行，而非硬编码每个步骤。Agent 在 harness 内受约束地执行，但保留自主判断的空间：

- **自然语言编排** — workflow.md 定义阶段和规则，agent 在每个 Stage 自主选择执行策略。同一个 workflow 在不同场景下可能走出不同路径
- **Stage 推进** — Agent 完成后返回结果，harness 推进到下一个 Stage
- **上下文隔离** — 每个 Agent 在独立的 subagent 上下文中运行，避免 token 膨胀
- **记忆自进化** — 执行前读取记忆注入上下文，执行后沉淀新知识。越用越聪明

### 核心概念

**Stage** — workflow 的执行阶段。每个 Stage 由 harness 协调，agent 自主决定执行方式：委托给 Agent、加载 Skill、或自行处理。

**Agent** — 可复用的执行单元（如 executor、debugger、reviewer、tester），在独立的 subagent 上下文中运行。

**Skill** — 可复用的专业技能（如 tdd、diagnose），指导如何解决某一类问题。

**MCP** — 与外部工具建立连接（如 Chrome DevTools、Figma）。

## 命令

### `talos list`

列出可用的 builtin workflows。

### `talos install [name]`

安装 workflow 到当前目录。

```bash
talos install              # 交互选择
talos install issue2code   # 安装指定 workflow
```

### `talos graph`

启动 web dashboard 查看会话执行图。默认端口 3456，可通过 `--port` 指定。

## 扩展

你可以在自己的仓库中维护自定义 workflow，满足日常开发需求。

### 创建自定义 Workflow

1. 进入你的项目仓库
2. 安装 skill：

```bash
npx skills add qingquan/talos
```

3. 启动 Claude Code 并运行 workflow-creator：

```bash
claude --dangerously-skip-permissions
# claude code：
# /workflow-creator create a workflow for my daily xx
```

生成的 workflow 目录结构：

```
your-repo/
└── workflows/
    └── <workflow-name>/
        ├── workflow.md       # 必需：编排定义
        ├── manifest.json     # 必需：依赖声明
        └── agents/           # 可选：workflow-local agents
            └── custom.md
```

`manifest.json` 声明 workflow 的依赖：

```json
{
  "memorize": true,
  "agents": ["agents/executor", "./agents/custom"],
  "skills": [{ "name": "tdd", "source": "mattpocock/skills" }],
  "mcp": [{ "name": "my-server", "command": "npx", "args": ["pkg"] }],
  "plugins": ["figma@claude-plugins-official"]
}
```

- `agents`：`agents/xx` 引用 builtin，`./agents/xx` 引用 workflow-local
- `skills`：从 [skills.sh](https://skills.sh) registry 下载
- `mcp`：内联配置对象，或路径引用（`./mcp/config.json`）
- `memorize`：workflow 完成后是否写记忆（默认 true）

### 安装外部 Workflow

从任意 git 仓库安装 workflow：

```bash
talos install --source https://github.com/org/workflows.git
```

## 开发 & 发布

```bash
npm install
npx tsx src/cli.ts list
npx tsx src/cli.ts install issue2code
```

发布新版本：

```bash
npm version patch   # 或 minor / major
git push --follow-tags
```
