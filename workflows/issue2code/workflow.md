# Issue2Code

基于已有的 issue（含 PRD）自动完成编码流程。

前提：issues 已存在于本地 `issues/` 或远程平台。PRD 生成和 issue 推送由用户在工作流外完成。

## stage 1 — 同步需求

委托 **tracker** agent 从配置的平台同步 issues 到本地 `issues/`。完成后展示 issue 列表，确认要处理哪个。

用户已提供 issue 或本地已有 `issues/` 时跳过。

## stage 2 — 需求拆分

委托 **splitissues** agent，传入 PRD 路径。Agent 加载 `to-issues` skill，将大型 PRD 拆分为可独立执行的 sub-issues。

issue 为 bug/缺陷类型，或 PRD 足够简单（单一功能、改动明确）时跳过。

## stage 3 — 实现

根据任务类型选择 agent：

- 新功能 / 增强 → 委托 **executor** agent，传入 PRD 路径和相关代码位置
- Bug / 回归 / 缺陷 → 委托 **debugger** agent，传入缺陷描述和相关代码位置

如果存在 sub-issues，按依赖顺序逐个执行，每个 sub-issue 独立委托 executor。

## stage 4 — 代码审查

委托 **reviewer** agent，传入 PRD（含验收标准）和代码变更摘要。

改动极小（typo、配置）时跳过。

## stage 5 — 提交

委托 **submitter** agent，传入 PRD 路径和 issue 编号。Agent 会对照 PRD 总结变更，与用户确认后 commit + push，并在 issue 上评论变更摘要。

用户明确要求暂不提交时跳过。
