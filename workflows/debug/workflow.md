# Debug Pipeline

基于已有的 bug PRD 自动完成缺陷修复流程。

前提：bug PRD 已就绪（含缺陷现象、复现步骤、期望行为）。异常分析和 PRD 生成由用户在工作流外完成。

## stage 1 — 修复

委托 **debugger** agent，传入 bug PRD 路径和相关代码位置。

## stage 2 — 代码审查

委托 **reviewer** agent，传入 bug PRD 和代码变更摘要。

改动极小（单行配置变更或样式微调）时跳过。

## stage 3 — 端到端验证

委托 **tester** agent，传入 bug PRD 和代码变更摘要。

纯后端改动或无法在浏览器中验证时跳过。

如果验证发现问题，回到 stage 1 交由 **debugger** agent 修复，修复后重新验证。
