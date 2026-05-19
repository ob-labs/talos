# Memorize Protocol

Workflow 执行前后的记忆读写协议。记忆是 workflow skill 的内建行为，不需要在 workflow.md 中定义 stage。

## 读记忆（stages 执行前）

在所有 stage 执行之前，读取三层记忆注入上下文：

1. `~/.talos/profile.md` — 用户偏好（编码风格、协作习惯、工具偏好）
2. `wiki/hot.md` — 项目热记忆（关键约束、重大坑、强偏好）
3. `wiki/INDEX.md` — 知识索引，按需深入具体页面

如果记忆文件不存在，跳过（首次运行）。读取后将内容作为上下文告知用户。

## 写记忆（所有 stages 完成后）

所有 stage 通过后，读取 `manifest.json` 的 `memorize` 配置：

- `memorize` 未设置或为 `true` → 委托 **memorizer** agent，传入所有 stages 的 summary
- `memorize` 为 `false` → 跳过写记忆（只读不写）

委托方式：`委托 **memorizer** agent，传入所有 stages 的 summary 汇总。`

## 三层记忆模型

| 层 | 路径 | 内容 | 格式 | 限制 |
|---|---|---|---|---|
| 用户偏好 | `~/.talos/profile.md` | 跨项目编码风格、协作习惯、工具偏好 | 纯文本要点 | ≤50 行 |
| 项目热记忆 | `wiki/hot.md` | 关键约束、重大坑、项目级强偏好 | 纯文本要点 | ≤100 行 |
| 项目知识库 | `wiki/<category>/<name>.md` | 领域知识、可复用模式、技术选型 | Obsidian markdown | 无硬限制 |

## 记录条件

满足以下条件之一才写入：

- 非显而易见的架构决策或约束
- 发现的坑 / 反模式 / 踩过的雷
- 项目特定的可复用模式
- 用户明确表达的偏好或纠正
- 项目结构的关键变化
