# Talos

运行在 Claude Code 内的 AI coding workflow 编排器。

## Quick Start

```bash
npm install -g talos-cli
talos install issue2code
```

然后在 Claude Code 中运行 `/workflow issue2code` 开始使用。

### 内置 Workflows

| 名称 | 用途 |
|------|------|
| `issue2code` | 从需求到代码的完整流程：同步 issue → PRD → 拆分 → 实现 → 审查 → E2E 验证 |
| `debug` | 缺陷诊断与修复：理解缺陷 → 调试循环 → 审查 |

## 架构

### Talos vs 传统 Workflow 平台

传统 workflow 平台（如 Dify）采用确定性编排：每个节点是一个明确的函数调用，输入输出由 JSON Schema 定义，流程严格执行预定义路径。

Talos 采用不同的设计哲学：

- **LLM 自主编排** — 每个 stage 不是确定性的函数，而是委托给 LLM agent。LLM 可以根据上下文自主决策执行策略（选择哪个 skill、如何处理异常、是否跳过某些步骤）
- **Markdown 定义流程** — workflow 用自然语言描述阶段和规则，不定义严格的输入输出 schema。维护成本极低
- **运行在 coding agent 内** — 不是独立平台，而是安装到项目的 `.claude/` 目录，和用户的代码、工具链、MCP server 共存
- **通过 subagent 隔离上下文** — 每个 agent 在独立的上下文中运行，避免 token 膨胀

对应的 trade-off：Talos 依赖 Claude Code 作为 runtime（没有独立 runtime），流程执行不如传统平台精确可控。但如果你认为 LLM 足够聪明能自主做出合理判断，这种自主性反而可能比硬编码的编排更灵活、更准确。

### Workflow 结构图

```
用户项目/
├── .claude/
│   ├── agents/              # 安装的 agent 定义
│   │   ├── executor.md
│   │   ├── debugger.md
│   │   └── ...
│   └── skills/              # 安装的 skill（builtin + registry）
│       ├── workflow/
│       ├── tdd/
│       └── ...
├── .workflows/
│   └── issue2code/
│       └── workflow.md      # workflow 编排定义
└── wiki/                    # 项目知识库（记忆层）
```

### 核心概念

**Agent** — 可复用的执行单元，定义了角色、输入输出、执行流程和依赖。builtin agents 在 talos 包的 `agents/` 目录维护，workflow 通过路径引用。

**Workflow** — 由 `workflow.md` 定义的阶段编排。每个 stage 可以委托给 agent、加载 skill、或由协调者自行处理。stage 编号从 1 开始。

**Manifest** — `manifest.json` 声明 workflow 的所有依赖：

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

**记忆** — workflow skill 的内建行为，不需要在 workflow.md 中定义 stage：
- 执行前自动读取三层记忆（用户偏好、项目热记忆、知识库）
- 执行后自动沉淀知识（`memorize: false` 时只读不写）

## 命令

### `talos list`

列出可用的 builtin workflows。

### `talos install [name]`

安装 workflow 到当前目录。

```bash
talos install              # 交互选择
talos install issue2code   # 安装指定 workflow
```

### `talos install --source <url> [name]`

从外部 git repo 安装 workflow。

```bash
talos install --source https://github.com/org/workflows.git
```

### `talos graph`

启动 web dashboard 查看会话执行图。默认端口 3456，可通过 `--port` 指定。

## 扩展

### 创建自定义 Workflow

在 Claude Code 中运行 `/workflow-creator` skill，交互式引导创建新的 workflow。

### 外部 Workflow Repo

维护一个独立的 git repo，通过 `talos install --source <url>` 安装。repo 结构：

```
your-repo/
└── workflows/
    └── <workflow-name>/
        ├── workflow.md       # 必需：编排定义
        ├── manifest.json     # 必需：依赖声明
        └── agents/           # 可选：workflow-local agents
            └── custom.md
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

GitHub Actions 自动构建并发布到 npm。
