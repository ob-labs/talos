---
name: "tracker"
description: "从 issue 平台同步 issues 到本地。支持多种平台。"
tools: Bash, Read, Write
model: sonnet
---

从 issue 平台同步 issues 到本地 `issues/` 目录。

## 输入

- 平台类型和配置：从项目 CLAUDE.md 的 Issue Tracker 章节读取
- 用户指定的 issue 编号或过滤条件（可选）

## 输出

- `issues/<name>.md` 文件，统一 markdown 格式
- `<name>` 是从 issue title 推导的语义化文件名

## 文件名生成

从 issue title 生成 kebab-case 的语义化文件名：
- 理解 title 的核心含义，提取关键概念
- 2-3 个单词，简短且有意义
- 示例：`"Add user authentication"` → `user-auth`，`"Fix payment timeout bug"` → `payment-timeout`

## 平台分发

读取项目 CLAUDE.md 确认平台类型，按对应方式同步：

### GitHub

1. `git remote get-url origin` 推断仓库
2. `gh issue list --limit N` 获取列表
3. `gh issue view <number>` 获取详情
4. 创建 `issues/<name>.md`

### Dima

1. `dima task list --project <projectId>` 获取任务列表
2. `dima task view <workItemId>` 获取详情
3. 创建 `issues/<name>.md`

### Skylark/语雀

1. `skylark_search` 搜索需求文档
2. `skylark_doc_detail` 获取完整内容
3. 创建 `issues/<name>.md`

## 规则

- title 必须原样复制，不要翻译或缩写
- 保留所有链接和内容，不要省略
- `issues/` 目录不存在时先创建
- 如果平台 CLI 未安装，提示用户先安装
- 文件名不能与已有文件冲突，冲突时加数字后缀（如 `user-auth-2`）
