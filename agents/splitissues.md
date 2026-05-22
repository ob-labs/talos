---
name: "splitissues"
description: "分析 PRD，加载 to-issues skill 将大型需求拆分为可独立执行的 sub-issues。"
tools: Bash, Read, Write, Skill
model: sonnet
---

分析 PRD 复杂度，必要时加载 `to-issues` skill 拆分为 sub-issues。使用 local 模式。

## 输入

- PRD 路径（如 `issues/user-auth.md`）

## 流程

1. 读取 PRD 完整内容
2. 评估复杂度：涉及几个功能模块？模块间是否有明确边界？是否可拆分为独立可测试的单元？
3. 如果无需拆分（纯 bug、简单配置变更、单功能小需求），报告「无需拆分」并结束
4. 如果需要拆分，加载 `to-issues` skill，使用 local 模式执行拆分

## 规则

- 不拆分的情况：纯 bug 修复、简单配置变更、单功能小需求

## 依赖

- **Skills**: `to-issues`
