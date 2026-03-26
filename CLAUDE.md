# CLAUDE.md

**[中文文档](docs/CLAUDE.zh-CN.md)**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Documentation Principles

**Important**: Technical documentation for this project should focus on **architectural abstraction descriptions**, avoiding specific implementation details. Code changes frequently, technical details quickly become outdated, while architectural principles remain relatively stable.

## Project Overview

Talos is an AI-assisted development workflow management system with core features including:
- PRD Generation: Generate structured PRDs through conversational AI chat interface
- Task Execution: Orchestrate AI agents to execute user stories in PRDs
- Intelligent Routing: Route to the best model based on task type
- Real-time Monitoring: Monitor execution progress in real-time via SSE streaming
- Process Management: Daemon manages multiple session lifecycles

## Package Structure

```
talos/
├── packages/
│   ├── types/      # Shared type definitions
│   ├── core/       # Core functionality (process management, logging, storage, communication, task management)
│   ├── git/        # Git operations wrapper
│   ├── terminal/   # Terminal management
│   ├── executor/   # AI tool executors (Claude Code, Cursor)
│   ├── logger/     # Logging system
│   ├── web/        # Web UI service wrapper
│   └── cli/        # Command-line tools
├── apps/
│   └── web/        # Web application (Next.js)
└── turbo.json      # Turbo build configuration
```

## Submodule Documentation

- **[@talos/core](packages/core/CLAUDE.md)** - Core architecture, process management, communication mechanisms
- **[@talos/cli](packages/cli/CLAUDE.md)** - CLI commands, task management, workflows
- **[@talos/git](packages/git/README.md)** - Git operations wrapper
- **[@talos/terminal](packages/terminal/README.md)** - Terminal management
- **[@talos/executor](packages/executor/README.md)** - AI tool executors
- **[@talos/logger](packages/logger/README.md)** - Logging system
- **[apps/web](apps/web/README.md)** - Web application architecture

## Coding Standards

### Architectural Principles

1. **Layered Architecture**: System has clear layers (entry, application, domain, infrastructure, anti-corruption), upper layers depend on lower layer interfaces, no cross-layer access
2. **Dependency Inversion**: High-level modules depend on abstract interfaces, low-level modules implement interfaces, inject dependencies through constructors
3. **Single Responsibility**: Each class has only one reason to change, keep files within reasonable line count, split if exceeded
4. **Anti-Corruption Isolation**: Encapsulate external dependencies through anti-corruption layer, external changes don't affect core code, easy to switch and upgrade
5. **Core Logic First**: Core capabilities must be in core package, entry layer prioritizes reusing core logic, doesn't duplicate implementation

### Code Principles

6. **Rich Domain Model**: Entities contain data and behavior, business logic encapsulated inside entities, state transitions through entity methods with validation
7. **Complete Persistence**: Repository only accepts complete entities, no partial updates, remove dedicated partial update methods
8. **Unique Responsibility**: Each data type's read/write operations are responsible by a single class, avoid multiple places implementing same logic
9. **Single State Writer**: Each state has only one write point, avoid race conditions, easy to trace and debug
10. **Explicit Design**: Fail immediately when required parameters are missing, don't use fallback to hide real errors
11. **Interface Segregation**: Interfaces only define data access contracts, don't contain business logic
12. **Consistent Style**: Code style is consistent, naming conventions are unified, easy to read and understand

### Infrastructure Principles

13. **Process Management**: Process manager returns process identifiers not references, avoid holding process handles
14. **Atomic Operations**: Write operations use atomic write strategy (temp file + rename), ensure data integrity
15. **Protocol Versioning**: Communication protocols add version field, support protocol upgrade and backward compatibility
16. **Unified Logging**: Define unified logging interface, different components implement same interface, consistent log format
17. **Event-Driven**: Use event bus for loose coupling communication, async execute event handlers, errors don't affect other handlers

## Error Handling

**API Layer**:
- Use unified error handling functions (`handleAPIError`, `handleValidationError`, etc.)
- Error messages use English, provide context information
- Don't expose stack traces in production

**Logging**:
- `logger.info()` - Information messages
- `logger.warn()` - Warnings
- `logger.error()` - Errors
- `logger.audit()` - Audit logs (critical operations)

## CLI Command Reference

### Talos Main Process Management

```bash
talos start          # Start Talos main process
talos stop           # Stop Talos main process
talos restart        # Restart Talos main process
talos status         # Check main process status
talos logs [-f|--follow] [-n|--lines <number>]  # View logs
talos health         # System health check
```

### Task Management

```bash
talos task start [--prd <path>]    # Start task (supports interactive multi-select PRD)
talos task status [--no-watch]     # View task status (real-time monitoring by default)
talos task list [--json]           # List all tasks
talos task logs <taskId> [-f] [-n] # View task logs (-f for follow, -n for line count)
talos task stop <taskId>           # Stop task
talos task resume <taskId>         # Resume task
talos task attach <taskId> [-f]    # Attach to task session (-f for real-time tracking)
talos task remove <taskId>         # Delete task and its resources
talos task clear [--force]         # Batch clear failed tasks
talos task health                   # Task health check
```

**Debug Mode**: `talos task start --prd <path> --debug` or `talos task resume <taskId> --debug`

**Log Path**: `.talos/logs/{taskId}.log`

### Workspace Management

```bash
talos workspace add <path> [--name <name>]  # Add workspace
talos workspace list [--json]               # List all workspaces
```

### PRD Management

```bash
talos prd                    # Create PRD through AI conversation
talos prd --session <id>     # Resume previous PRD session
talos prd --list             # List all PRD sessions
talos prd --delete <id>      # Delete a PRD session
talos ralph [prdIdentifier]  # Convert PRD to Ralph format
```

**Detailed Documentation**: [Process Management and Troubleshooting Guide](packages/core/docs/PROCESS_MANAGEMENT.md)

## Related Resources

### Architecture Documentation
- **[Documentation Guidelines](docs/DOCUMENTATION_GUIDELINES.md)** - How to write project documentation
- **[Storage Architecture Design](packages/core/docs/STORAGE_ARCHITECTURE.md)** - Storage system design
- **[Process Management Architecture](packages/core/docs/PROCESS_MANAGEMENT.md)** - Process lifecycle management

### Subpackage Documentation
- **[@talos/core](packages/core/CLAUDE.md)** - Core package development guide
- **[@talos/cli](packages/cli/CLAUDE.md)** - CLI development guide
- **[apps/web](apps/web/README.md)** - Web application architecture

### System Documentation
- **[System Service Installation](packages/core/docs/SERVICE_INSTALL.md)** - Daemon service configuration
