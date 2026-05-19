# Issue2Code

通过 subagent 协调完成任务流程。

## stage 0 — 同步需求

委托 **tracker** agent 从 GitHub 同步 issues 到本地 `issues/`。完成后展示 issue 列表，确认要处理哪个。

用户已提供 issue 或明确指定需求时跳过。

## stage 1 — 生成 PRD

加载 **to-prd** skill，基于选定的 issue 生成 PRD 到 `prds/`。需要与用户交互确认需求理解，完成后展示摘要。

任务简单（小 bug、单行改动）时跳过。

## stage 2 — 拆分 Issues

加载 **to-issues** skill，将 PRD 拆分为可独立交付的 issue。

PRD 一个 slice 能完成时跳过。

## stage 3 — 实现

根据任务类型选择 agent：

- 新功能 / 增强 → 委托 **executor** agent，传入 PRD 路径和相关代码位置
- Bug / 回归 / 缺陷 → 委托 **debugger** agent，传入缺陷描述和相关代码位置

## stage 4 — 代码审查

委托 **reviewer** agent，传入 PRD（含验收标准）和代码变更摘要。

改动极小（typo、配置）时跳过。

## stage 5 — 端到端验证

委托 **tester** agent，传入 PRD（含验收标准）和代码变更摘要。

纯后端改动或无法在浏览器中验证时跳过。

如果验证发现问题，回到 stage 3 交由 **executor** agent 修复，修复后重新验证。
