# CLAUDE.md

**[English](../CLAUDE.md)**

本文件提供 Claude Code (claude.ai/code) 在此代码库中工作时需要的指导。

## 🎯 文档编写原则

**重要**: 本项目的技术文档应关注**架构层面的抽象描述**，避免陷入具体实现细节。代码变更频繁，技术细节很快过时，而架构原则相对稳定。

## 项目概览

Talos 是一个 AI 辅助开发工作流管理系统，核心功能包括：
- PRD 生成：通过对话式 AI 聊天界面生成结构化 PRD
- 任务执行：编排 AI 代理执行 PRD 中的用户故事
- 智能路由：根据任务类型智能路由到最佳模型
- 实时监控：通过 SSE 流式传输实时监控执行进度
- 进程管理：守护进程管理多个 Session 的生命周期

## 包结构

```
talos/
├── packages/
│   ├── types/      # 共享类型定义
│   ├── core/       # 核心功能（进程管理、日志、存储、通信、任务管理）
│   ├── git/        # Git 操作封装
│   ├── terminal/   # 终端管理
│   ├── executor/   # AI 工具执行器（Claude Code、Cursor）
│   ├── logger/     # 日志系统
│   ├── web/        # Web UI 服务包装
│   └── cli/        # 命令行工具
├── apps/
│   └── web/        # Web 应用（Next.js）
└── turbo.json      # Turbo 构建配置
```

## 子模块文档

- **[@talos/core](../packages/core/CLAUDE.md)** - 核心架构、进程管理、通信机制
- **[@talos/cli](../packages/cli/CLAUDE.md)** - CLI 命令、任务管理、工作流
- **[@talos/git](../packages/git/README.md)** - Git 操作封装
- **[@talos/terminal](../packages/terminal/README.md)** - 终端管理
- **[@talos/executor](../packages/executor/README.md)** - AI 工具执行器
- **[@talos/logger](../packages/logger/README.md)** - 日志系统
- **[apps/web](../apps/web/README.md)** - Web 应用架构

## 编码规范

### 架构原则

1. **分层架构**：系统分为清晰的层次（入口、应用、领域、基础设施、防腐），上层依赖下层接口，不跨层访问
2. **依赖倒置**：高层模块依赖抽象接口，低层模块实现接口，通过构造函数注入依赖
3. **单一职责**：每个类只有一个变化原因，文件控制在合理行数内，超过则拆分
4. **防腐隔离**：通过防腐层封装外部依赖，外部变化不影响核心代码，便于切换和升级
5. **核心逻辑优先**：核心能力必须在核心包中，入口层优先复用核心逻辑，不重复实现

### 代码原则

6. **充血模型**：实体包含数据和行为，业务逻辑封装在实体内部，状态转换通过实体方法并包含验证
7. **完整持久化**：Repository 只接受完整实体，不接受部分更新，删除专门的部分更新方法
8. **职责唯一**：每种数据的读写操作由唯一类负责，避免多处实现相同逻辑
9. **状态唯一**：每个状态只有一个写入点，避免竞争条件，便于追踪和调试
10. **显式设计**：必需参数缺失时立即失败，不使用 fallback 隐藏真正错误
11. **接口隔离**：接口只定义数据访问契约，不包含业务逻辑
12. **风格统一**：代码风格一致，命名规范统一，便于阅读和理解

### 基础设施原则

13. **进程管理**：进程管理器返回进程标识符而非引用，避免持有进程句柄
14. **原子操作**：写操作使用原子写入策略（临时文件 + 重命名），保证数据完整性
15. **协议版本管理**：通信协议添加版本字段，支持协议升级和向后兼容
16. **日志统一**：定义统一的日志接口，不同组件实现相同接口，日志格式一致
17. **事件驱动**：使用事件总线实现松耦合通信，异步执行事件处理器，错误不影响其他处理器


## 错误处理

**API 层**：
- 使用统一的错误处理函数（`handleAPIError`, `handleValidationError` 等）
- 错误消息使用中文，提供上下文信息
- 生产环境不暴露堆栈跟踪

**日志**：
- `logger.info()` - 信息消息
- `logger.warn()` - 警告
- `logger.error()` - 错误
- `logger.audit()` - 审计日志（关键操作）


## CLI 命令参考

### Talos 主进程管理

```bash
talos start          # 启动 Talos 主进程
talos stop           # 停止 Talos 主进程
talos restart        # 重启 Talos 主进程
talos status         # 查看主进程状态
talos logs [-f|--follow] [-n|--lines <number>]  # 查看日志
talos health         # 系统健康检查
```

### 任务管理

```bash
talos task start [--prd <path>]    # 启动任务（支持交互式多选 PRD）
talos task status [--no-watch]     # 查看任务状态（默认实时监控）
talos task list [--json]           # 列出所有任务
talos task stop <taskId>           # 停止任务
talos task resume <taskId>         # 恢复任务
talos task attach <taskId> [-f]    # 进入任务会话（-f 实时跟踪）
talos task remove <taskId>         # 删除任务及其资源
talos task clear [--force]         # 批量清除失败任务
talos task health                   # 任务健康检查
```

**调试模式**：`talos task start --prd <path> --debug` 或 `talos task resume <taskId> --debug`

**日志路径**：`.talos/logs/{taskId}.log`

### Workspace 管理

```bash
talos workspace add <path> [--name <name>]  # 添加 workspace
talos workspace list [--json]               # 列出所有 workspace
```

### PRD 管理

```bash
talos prd                    # 通过 AI 对话创建 PRD
talos ralph [prdIdentifier]  # 转换 PRD 为 Ralph 格式
```


**详细文档**: [进程维护方案与排查指南](../packages/core/docs/PROCESS_MANAGEMENT.md)

## 相关资源

### 架构文档
- **[文档编写规范](DOCUMENTATION_GUIDELINES.md)** - 如何编写项目文档
- **[存储架构设计](../packages/core/docs/STORAGE_ARCHITECTURE.md)** - 存储系统设计
- **[进程管理架构](../packages/core/docs/PROCESS_MANAGEMENT.md)** - 进程生命周期管理

### 子包文档
- **[@talos/core](../packages/core/CLAUDE.md)** - 核心包开发指南
- **[@talos/cli](../packages/cli/CLAUDE.md)** - CLI 开发指南
- **[apps/web](../apps/web/README.md)** - Web 应用架构

### 系统文档
- **[系统服务安装](../packages/core/docs/SERVICE_INSTALL.md)** - 守护进程服务配置
