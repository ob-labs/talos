# Issue2Code

通过 subagent 协调完成任务流程。

## stage 0 — 加载记忆

加载三层记忆：
1. 读取 `~/.talos/profile.md` 了解用户偏好
2. 读取 `wiki/hot.md` 了解项目关键约束
3. 读取 `wiki/INDEX.md` 了解知识索引，按需深入具体页面

## stage 1 — 同步需求

委托 **tracker** agent 从 GitHub 同步 issues 到本地 `issues/`。完成后展示 issue 列表，确认要处理哪个。

用户已提供 issue 或明确指定需求时跳过。

## stage 2 — 生成 PRD

加载 **to-prd** skill，基于选定的 issue 生成 PRD 到 `prds/`。需要与用户交互确认需求理解，完成后展示摘要。

任务简单（小 bug、单行改动）时跳过。

## stage 3 — 拆分 Issues

加载 **to-issues** skill，将 PRD 拆分为可独立交付的 issue。

PRD 一个 slice 能完成时跳过。

## stage 4 — 实现

委托 **executor** agent，传入 PRD 路径和相关代码位置。

## stage 5 — 代码审查

委托 **reviewer** agent，传入 PRD（含验收标准）和代码变更摘要。

改动极小（typo、配置）时跳过。

## stage 6 — 沉淀知识

委托 **memorizer** agent，传入 PRD、代码变更摘要、review 结果及执行过程中的关键发现。
