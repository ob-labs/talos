---
name: workflow
description: >
  运行预定义的 AI coding workflow。当用户提到 /workflow、工作流、workflow 或类似语义时触发。
user-invocable: true
---

# Workflow Runner

执行 `.workflows/<name>/workflow.md` 中定义的 workflow，按 stage 逐步推进，直到全部完成。用法：`/workflow <name>`。

## 协调者角色 — CRITICAL

**CRITICAL**: Workflow 运行期间，你是协调者，不是执行者。

当 stage 的 `subagent` 非空时：
- **MUST** 通过 Agent 工具委托
- **MUST NOT** 对项目源码使用 Edit/Write（stages.json 除外）
- 如果发现自己在写业务代码，**立即停止**，改为调用 Agent

当 `subagent` 为空时：自行处理（对话、协调、轻量操作）。

## 生命周期

### 1. 初始化

读取 workflow.md，解析为 stages 数组，写入 stages.json。

**写入路径**: `~/.talos/<workspace>/<workflowName>/<runId>/stages.json`

- `<workspace>` = 当前项目目录名（`basename "$PWD"`）
- `<runId>` = 当前时间戳，格式 `YYYYMMDDHHmmss`（如 `20260518153042`）
- 写入前确保目录存在

stages.json 顶层结构：

```json
{
  "runId": "20260518153042",
  "workflowName": "default",
  "sessions": ["$CLAUDE_CODE_SESSION_ID"],
  "stages": [
    {
      "stage": 0,
      "name": "stage 名称",
      "desc": "...",
      "passes": false,
      "summary": null,
      "subagent": null
    }
  ]
}
```

每次更新 stages.json 时，确保当前 `$CLAUDE_CODE_SESSION_ID` 在 `sessions` 数组中。

### 2. 读记忆

加载 `memorize.md` 中的记忆协议。在 stages 执行前，读取三层记忆注入上下文：

1. `~/.talos/profile.md` — 用户偏好
2. `wiki/hot.md` — 项目热记忆
3. `wiki/INDEX.md` — 知识索引

如果文件不存在则跳过。读取后将内容作为上下文告知用户。

### 3. 执行循环

对每个 stage 按顺序执行：

1. **前置检查** — 确认上一个 stage 的 `passes == true`。stage 1 跳过此检查。如果上一个 stage 未通过，不继续推进，报告当前状态让用户决定。
2. **评估跳过** — 根据 workflow.md 中该 stage 的跳过条件（"XX时跳过"）和当前上下文判断是否跳过。如果条件明确满足，直接标记 `passes: true`，summary 写明跳过原因。如果不确定，问用户。
3. **宣告** — 告诉用户即将执行哪个 stage 以及执行方式（委托给哪个 agent / 自行处理）。
4. **执行** — 按宣告的方式执行该 stage。
5. **自检** — 重新读取当前 stage 的 desc，逐条检查完成标准是否满足。不要假设执行完就等于完成——验证产出物是否存在、是否符合 desc 的要求。
6. **更新状态** — 自检通过后，标记 `passes: true`，写入 `summary`。如果未通过，报告缺失内容，询问用户如何处理。

### 4. 完成

所有 stage 通过后：
- 向用户报告 workflow 整体完成
- 列出所有阶段产出的 artifacts 汇总

### 5. 写记忆

读取 `manifest.json` 的 `memorize` 配置：

- `memorize` 未设置或为 `true` → 委托 **memorizer** agent，传入所有 stages 的 summary
- `memorize` 为 `false` → 跳过写记忆

## 解析规则

从 workflow.md 提取 stages 时遵循以下约定。

**Stage 标题格式**（精确匹配）：

```
## stage N — name
```

从中提取 `stage`（序号）和 `name`。

**字段提取**：

| 字段 | 提取方式 |
|------|---------|
| `desc` | 标题后的全部正文 |
| `subagent` | 正文中 "委托 **X** agent" → `["X"]`，多个则全放入数组，没有则 `null` |
| 跳过条件 | 正文中 "XX时跳过" → 保留在 desc 中，执行时由协调者参考 |

## 规则

- workflow.md 是唯一事实来源
- 遇到错误先报告用户再继续
