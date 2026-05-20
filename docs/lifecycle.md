# Workflow Coding 生命周期

一个完整的从需求到交付的闭环，分为两个阶段：**准备**（交互式）和**执行**（Talos 自动化）。

```
┌─────────────────────────────────────────────────────────────┐
│  准备阶段（交互式）                                          │
│                                                             │
│  需求理解 → PRD 生成 → PRD 推送到 Issue 平台                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  执行阶段（Talos 自动化，每个 stage 是独立 subagent）         │
│                                                             │
│  同步 Issue → 实现 → 审查 → 验证 → 提交 → 沉淀               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 一、准备阶段

这个阶段在 Talos workflow 外部完成，需要人参与决策。目的是把需求转化为一份结构化的 PRD，并推送到 issue 平台。

### 1. 需求理解

与需求方沟通，明确要做什么、为什么做、验收标准是什么。

### 2. 生成 PRD

基于对话上下文生成 PRD。生成方式不限 — 可以用 skill、手动编写、或任何其他手段。Talos 只关心 PRD 是否作为 issue 存在于平台上。

### 3. 推送 PRD 到 GitHub

```bash
gh issue create --title "PRD标题" --body "PRD全文" --label "ready-for-agent"
```

> 推送方式由项目 CLAUDE.md 的 Issue Tracker 章节定义，Talos 不内置任何推送逻辑。对于非 GitHub 平台，可以在项目 CLAUDE.md 中配置对应的 CLI 或 MCP 工具。

---

## 二、执行阶段

以 `/workflow issue2code` 为例。Talos 接管后，每个 stage 委托给独立的 subagent 黑盒执行：

```
tracker → executor → reviewer → tester → memorizer → submitter
 同步      实现       审查       验证      沉淀        提交
```

执行过程是全自动的：协调者按顺序推进，每个 stage 完成后自检，通过则进入下一个。如果 E2E 验证发现问题，回到实现阶段修复后重新验证。

执行中可通过 `talos graph` 实时查看各 stage 状态和工具调用详情。

完成后 **memorizer** agent 自动将本次任务中有价值的知识写入三层记忆（`~/.talos/profile.md`、`wiki/hot.md`、`wiki/`），供后续执行复用。

**submitter** stage 在最后触发，需要用户确认后推进。

---

## 完整示例

以一个实际需求为例，展示完整生命周期：

**需求**：用户反馈列表页加载缓慢，需要加分页。

```
# 准备阶段（约 10 分钟）

1. 与用户确认需求范围（哪些列表、分页大小、是否支持跳页）
2. 生成 PRD（含 User Stories、模块划分、测试策略）
3. gh issue create → 推送 PRD 到 GitHub，打上 ready-for-agent label

# 执行阶段（约 20-40 分钟）

4. /workflow issue2code
   → tracker: 从 GitHub 同步 issue 到本地
   → executor: 根据 PRD 实现分页组件和 API 对接
   → reviewer: 审查代码变更
   → tester: 在浏览器中验证分页交互
   → memorizer: 记录分页相关的项目知识
   → submitter: 确认后提交代码，在 issue 上评论变更摘要
```
