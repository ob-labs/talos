# Issue2Code

基于已有的 issue（含 PRD）自动完成编码流程。

前提：issues 已存在于本地 `issues/` 或远程平台。PRD 生成和 issue 推送由用户在工作流外完成。

## stage 1 — 同步需求

委托 **tracker** agent 从配置的平台同步 issues 到本地 `issues/`。完成后展示 issue 列表，确认要处理哪个。

用户已提供 issue 或本地已有 `issues/` 时跳过。

## stage 2 — 实现

根据任务类型选择 agent：

- 新功能 / 增强 → 委托 **executor** agent，传入 PRD 路径和相关代码位置
- Bug / 回归 / 缺陷 → 委托 **debugger** agent，传入缺陷描述和相关代码位置

## stage 3 — 代码审查

委托 **reviewer** agent，传入 PRD（含验收标准）和代码变更摘要。

改动极小（typo、配置）时跳过。

## stage 4 — 端到端验证

委托 **tester** agent，传入 PRD（含验收标准）和代码变更摘要。

纯后端改动或无法在浏览器中验证时跳过。

如果验证发现问题，回到 stage 2 交由 **executor** agent 修复，修复后重新验证。
