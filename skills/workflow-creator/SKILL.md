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

产出一组文件到 `workflows/<name>/` 目录，可通过 `talos install <name>` 安装到目标项目。

## 四层架构

| 层 | 文件 | 职责 |
|---|---|---|
| **编排** | `workflow.md` | 定义 stages 和协调规则 |
| **代理** | `agents/*.md` | 定义 subagent 的能力边界和执行指令 |
| **技能** | `skills.json` | 声明外部 skill 依赖（来源 + 名称） |
| **工具** | `mcp.json` | 声明 MCP servers 和 plugins 依赖 |

**解耦原则**：

1. `workflow.md` 只引用 agent 名（`委托 **X** agent`），不嵌入 agent 逻辑
2. Agent 不硬编码 skill 内容，只引用 skill 名（`加载 **X** skill`）
3. `skills.json` 是 skill 的唯一来源——每个被引用的 skill 都要有条目
4. `mcp.json` 是 MCP 的唯一来源——每个被引用的 MCP 都要声明
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

从终点向前回溯，每个前置条件是一个 stage。

**分工决策**：

| 特征 | 处理方式 | workflow.md 写法 |
|---|---|---|
| 频繁用户交互（澄清、确认、选择） | Main agent 自行处理 | 无 subagent/skill 关键词 |
| 范围明确、自包含执行（写代码、审查、测试） | 委托 subagent | `委托 **X** agent` |
| 可复用程序化模式（TDD、调试、PRD） | 加载 skill | `加载 **X** skill` |

输出 stage 列表给用户确认，括号内标注执行方式：

```
Stage 0: 准备上下文 [main]
Stage 1: 诊断 [agent: diagnostician]
Stage 2: 修复 [agent: fixer]
Stage 3: 验证 [skill: tdd]
```

用户确认后进入 Phase 3。

### Phase 3: Skill & MCP 发现

对每个需要外部能力的 stage：

1. **用户已知** → 直接记入 skills.json / mcp.json
2. **用户描述需求但不知名称** → 用 WebSearch 搜索 `site:skills.sh <关键词>` 或引导浏览 https://www.skills.sh
3. **找不到** → 告知用户，可后续用 `/skill-creator` 创建

### Phase 4: 生成文件

按顺序生成到 `workflows/<name>/`：

1. `workflow.md`
2. `agents/*.md`
3. `skills.json`
4. `mcp.json`

生成后执行验证清单。

## 输出格式

### workflow.md

兼容 workflow runner 解析规则：

- Stage 标题：`## stage N — name`
- Subagent 委托：`委托 **X** agent`
- Skill 加载：`加载 **X** skill`
- 跳过条件（可选）：`XX时跳过`

```markdown
# <Workflow 名称>

一句话描述。

## stage 0 — <stage 名称>

<stage 描述>

委托 **<agent-name>** agent，传入 <参数>。

<可选：XX时跳过>
```

### agents/*.md

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

### skills.json

```json
{
  "skills": [
    { "name": "tdd", "source": "mattpocock/skills" },
    { "name": "code-review", "source": "obra/superpowers", "installName": "requesting-code-review" }
  ]
}
```

### mcp.json

```json
{
  "mcp": [
    {
      "name": "server-name",
      "transport": "stdio",
      "command": "command",
      "args": ["arg1"]
    }
  ],
  "plugins": [
    { "ref": "plugin-name@source" }
  ]
}
```

## 验证清单

1. workflow.md 中每个 `委托 **X** agent` 的 X，都有 `agents/X.md`
2. 每个 agent `## 依赖` 中的 skill，都在 `skills.json` 中有条目
3. 每个 agent `## 依赖` 中的 MCP，都在 `mcp.json` 中声明
4. `skills.json` 和 `mcp.json` 无孤儿条目
5. Stage 编号从 0 连续递增
6. 每个 stage 的完成标准在描述中清晰可判定

## 完整示例：Bug Fix Pipeline

**workflow.md**：

```markdown
# Bug Fix Pipeline

快速修复 bug 的精简流程。

## stage 0 — 诊断

委托 **diagnostician** agent，传入 bug 描述和复现步骤。

bug 描述清晰且用户已定位根因时跳过。

## stage 1 — 修复

委托 **fixer** agent，传入诊断结果和建议修复方案。

## stage 2 — 验证

加载 **tdd** skill，为修复编写回归测试。

修复是单行配置变更且无逻辑影响时跳过。
```

**agents/diagnostician.md**：

```markdown
---
name: "diagnostician"
description: "诊断 bug 根因。当需要分析错误日志、复现问题、定位代码缺陷时使用。"
tools: Bash, Read, Skill
model: sonnet
---

分析 bug 报告，定位根因并给出修复建议。

## 输入

- bug 描述文本
- 复现步骤（如有）

## 输出

- 根因分析报告
- 建议修复方案

## 流程

1. 读取 bug 描述，提取关键信息
2. 搜索相关代码文件
3. 加载 `diagnose` skill 进行系统化诊断
4. 总结根因和修复建议

## 依赖

- **Skills**: `diagnose` — 系统化 bug 诊断

## 规则

- 先理解问题再动手
- 记录诊断过程中的每一步发现
```

**agents/fixer.md**：

```markdown
---
name: "fixer"
description: "根据诊断结果实现 bug 修复。"
tools: Bash, Read, Write, Edit, Skill
model: sonnet
---

根据诊断结果实现代码修复。

## 输入

- 诊断报告（根因、影响范围）
- 建议修复方案

## 输出

- 修复后的代码
- 修复说明

## 流程

1. 读取诊断报告，理解根因
2. 定位需要修改的代码
3. 实现修复
4. 验证未引入新问题

## 依赖

- **Skills**: `systematic-debugging` — 复杂问题的系统化修复

## 规则

- 最小化修改范围
- 验证原有功能不受影响
```

**skills.json**：

```json
{
  "skills": [
    { "name": "diagnose", "source": "mattpocock/skills" },
    { "name": "systematic-debugging", "source": "obra/superpowers" }
  ]
}
```

**mcp.json**：

```json
{
  "mcp": [],
  "plugins": []
}
```
