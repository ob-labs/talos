# Debug Pipeline

基于已有的 bug PRD 自动完成缺陷修复流程。

前提：bug PRD 已就绪（含缺陷现象、复现步骤、期望行为）。异常分析和 PRD 生成由用户在工作流外完成。

## stage 1 — 修复

委托 **debugger** agent，传入 bug PRD 路径和相关代码位置。

## stage 2 — 代码审查

委托 **reviewer** agent，传入 bug PRD 和代码变更摘要。

改动极小（单行配置变更或样式微调）时跳过。

## stage 3 — 沉淀

委托 **memorizer** agent，传入所有已完成 stages 的 summary，将任务中的知识写入三层记忆。

## stage 4 — 提交

委托 **submitter** agent，传入 bug PRD 路径和 issue 编号。Agent 会对照 PRD 总结变更，与用户确认后 commit + push，并在 issue 上评论变更摘要。

用户明确要求暂不提交时跳过。
