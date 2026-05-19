---
name: workflow-creator
description: >
  引导用户创建标准化的 Talos workflow。当用户想创建新 workflow、设计 AI coding 流程、
  搭建多阶段 agent pipeline、或说"帮我创建一个 workflow"、"设计流程"、"自动化 XX"、
  "创建 pipeline"、"搭建工作流" 时触发。
user-invocable: true
---

# Workflow Creator

引导用户从意图出发，创建标准化、可执行的 Talos workflow。

产出一组文件：`workflows/<name>/` 目录下的 `workflow.md` 和 `manifest.json`，可通过 `talos install <name>` 安装到目标项目。

## 架构

| 层 | 文件 | 职责 |
|---|---|---|
| **编排** | `workflow.md` | 定义 stages 和协调规则 |
| **配置** | `manifest.json` | 声明依赖（agents、skills、mcp、plugins）和配置（memorize） |
| **代理** | `agents/*.md`（root） | 可复用的 builtin agent 库，workflow 通过路径引用 |
| **记忆** | `skills/workflow/memorize.md` | 记忆读写协议，workflow skill 内建行为 |

**解耦原则**：

1. `workflow.md` 只引用 agent 名（`委托 **X** agent`），不嵌入 agent 逻辑
2. Agent 不硬编码 skill 内容，只引用 skill 名（`加载 **X** skill`）
3. `manifest.json` 是唯一的配置来源——依赖和配置都在此声明
4. 记忆是 workflow skill 的内建行为，不需要在 workflow.md 中定义 stage
5. 每个依赖只在一处声明

## 交互流程

### Phase 1: 捕获意图

从对话上下文提取，缺失的再问。搞清楚四件事：

1. **目标**：完成什么？
2. **起点**：典型输入是什么？（issue、设计稿、prompt？）
3. **终点**：期望的最终交付物？（PR、部署、文档？）
4. **参考**：有无已有 workflow 可借鉴？

意图已清晰时跳过冗余提问。

### Phase 2: 设计 Stages

从终点向前回溯，每个前置条件是一个 stage。**不需要** 手动添加记忆 stage（读记忆和写记忆由 workflow skill 自动处理）。

**分工决策**：

| 特征 | 处理方式 | workflow.md 写法 |
|---|---|---|
| 频繁用户交互（澄清、确认、选择） | Main agent 自行处理 | 无 subagent/skill 关键词 |
| 范围明确、自包含执行（写代码、审查、测试） | 委托 subagent | `委托 **X** agent` |
| 可复用程序化模式（TDD、调试、PRD） | 加载 skill | `加载 **X** skill` |

**Agent 复用**：设计 stage 时先检查 `agents/` 目录中的已有 builtin agent。只在无合适 builtin agent 时才建议创建新的（放在 `agents/` 目录，通过 `manifest.json` 引用）。

输出 stage 列表给用户确认，括号内标注执行方式：

```
Stage 0: 理解缺陷 [main]
Stage 1: 调试验证 [agent: debugger]
Stage 2: 代码审查 [agent: reviewer]
```

用户确认后进入 Phase 3。

### Phase 3: Skill & MCP 发现

对每个需要外部能力的 stage：

1. **用户已知** → 直接记入 manifest.json
2. **用户描述需求但不知名称** → 用 WebSearch 搜索 `site:skills.sh <关键词>` 或引导浏览 https://www.skills.sh
3. **找不到** → 告知用户，可后续用 `/skill-creator` 创建

### Phase 4: 生成文件

按顺序生成：

1. `workflows/<name>/workflow.md`
2. `workflows/<name>/manifest.json`
3. 如果需要新 agent：`agents/<name>.md`

生成后执行验证清单。

## 输出格式

### workflow.md

兼容 workflow runner 解析规则：

- Stage 标题：`## stage N — name`
- Subagent 委托：`委托 **X** agent`
- Skill 加载：`加载 **X** skill`
- 跳过条件（可选）：`XX时跳过`

**不需要** 包含记忆相关 stage（读记忆和写记忆由 workflow skill 自动处理）。

```markdown
# <Workflow 名称>

一句话描述。

## stage 0 — <stage 名称>

<stage 描述>

委托 **<agent-name>** agent，传入 <参数>。

<可选：XX时跳过>
```

### manifest.json

```json
{
  "memorize": true,
  "agents": [
    "agents/<builtin-agent-name>",
    "./agents/<local-agent-name>"
  ],
  "skills": [
    { "name": "<name>", "source": "<source>" }
  ],
  "mcp": [
    {
      "name": "<name>",
      "transport": "stdio",
      "command": "<command>",
      "args": ["<arg>"]
    }
  ],
  "plugins": [
    "<plugin-ref>"
  ]
}
```

字段说明：
- `memorize`: 是否在 workflow 完成后写记忆。默认 `true`。设为 `false` 只读不写
- `agents`: 路径引用。`agents/xx` 引用 builtin（root agents/），`./agents/xx` 引用 workflow-local
- `skills`: 从 skills.sh registry 下载
- `mcp`: 内联配置对象，或路径引用（`./mcp/config.json`）
- `plugins`: plugin ref 字符串

### agents/*.md

只在无合适 builtin agent 时才创建新 agent，放在 root `agents/` 目录：

```markdown
---
name: "<kebab-case>"
description: "<一句话：做什么 + 何时用>"
tools: Bash, Read, Write, Edit, Skill
model: sonnet
---

<2-3 句职责说明>

## 输入

<接收什么>

## 输出

<产出什么>

## 流程

1. <步骤>
2. ...

## 依赖

- **Skills**: `<name>` — <使用条件>
- **MCP**: <server> — <用途>

## 规则

- <约束>
```

## 验证清单

1. workflow.md 中每个 `委托 **X** agent` 的 X，在 `manifest.json` 的 agents 中有对应路径
2. 每个 agent `## 依赖` 中的 skill，都在 `manifest.json` 的 skills 中有条目
3. 每个 agent `## 依赖` 中的 MCP，都在 `manifest.json` 的 mcp 中声明
4. manifest.json 无孤儿条目（所有声明的依赖都被 workflow.md 或 agent 引用）
5. Stage 编号从 0 连续递增
6. 每个 stage 的完成标准在描述中清晰可判定
7. workflow.md 不包含记忆相关 stage（由 workflow skill 自动处理）

## 完整示例：Debug Pipeline

**workflow.md**：

```markdown
# Debug Pipeline

Web 缺陷诊断与修复流程。

## stage 0 — 理解缺陷

与用户对话，理解缺陷现象、复现步骤、期望行为。

在完整理解缺陷之前可以多次询问用户，不要急于进入调试阶段。确认理解后输出结构化的缺陷描述。

## stage 1 — 调试验证

委托 **debugger** agent，传入缺陷描述和相关代码位置。

## stage 2 — 代码审查

委托 **reviewer** agent，传入修复代码。

缺陷为单行配置变更或样式微调时跳过。
```

**manifest.json**：

```json
{
  "memorize": true,
  "agents": [
    "agents/debugger",
    "agents/reviewer"
  ],
  "skills": [
    { "name": "diagnose", "source": "mattpocock/skills" },
    { "name": "code-review", "source": "obra/superpowers", "installName": "requesting-code-review" },
    { "name": "knowledge-synthesis", "source": "anthropics/knowledge-work-plugins" },
    { "name": "obsidian-markdown", "source": "kepano/obsidian-skills" }
  ],
  "mcp": [],
  "plugins": []
}
```

**agents/debugger.md**：

```markdown
---
name: "debugger"
description: "诊断并修复缺陷。当需要分析 bug、定位根因、修复问题并验证时使用。"
tools: Bash, Read, Write, Edit, Skill
model: sonnet
---

循环诊断缺陷：用 diagnose skill 深度分析，根据环境选择合适的工具验证并采集 debug 数据，直到问题确认解决。

## 输入

- 缺陷描述和复现步骤
- 相关代码位置（如有）

## 输出

- 根因分析
- 修复后的代码
- 验证结果

## 流程

1. 加载 `diagnose` skill 进行系统化分析，形成初始假设
2. 根据缺陷环境选择工具验证假设（浏览器用 Chrome DevTools，后端用日志/断点等）
3. 根据收集的数据修正假设，定位根因
4. 实现修复
5. 再次验证修复效果
6. 验证不通过则回到步骤 1，带入新数据继续分析
7. 验证通过后输出结论

## 依赖

- **Skills**: `diagnose` — 系统化 bug 诊断

## 规则

- 每轮循环必须收集新的证据，不允许空转
- 优先复现再修复，不在没有证据的情况下改代码
- 修复后必须验证原场景通过
```
