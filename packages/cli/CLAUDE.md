# @talos/cli - CLI Package Development Guide

## Package Positioning

The CLI package is the user entry layer of the Talos system, responsible for command parsing and dispatch, user interaction, and workflow orchestration.

**Core Principle**: Thin wrapper layer, core logic implemented in `@talos/core` and other packages.

- For general architecture principles, see [Root Directory CLAUDE.md](../../CLAUDE.md)

## Command Organization

```
talos              # Main process management (start, stop, status, logs)
talos task         # Task management (start, monitor, list, stop, resume, remove, clear, attach, health)
talos workspace    # Workspace management (add, list)
talos prd          # PRD generation
talos ralph        # PRD conversion
talos health       # Health check
talos archive      # PRD archiving
```

Commands are registered in `src/index.ts` via Commander.js, using dynamic imports for lazy loading.

## Directory Structure

```
packages/cli/src/
├── commands/       # Command implementations (grouped by functional domain)
├── client/         # Client (TalosClient)
├── ui/             # UI components
└── index.ts        # CLI entry point
```

## Dependency Packages

- `@talos/types` - Shared types
- `@talos/core` - Core functionality (process management, logging, storage, task management)
- `@talos/git` - Git operations

The CLI package should not directly operate on processes, Sockets, or the file system; it should use the abstractions provided by core.

## Key Architectural Patterns

### Task = Session
Each Task has built-in Session capabilities, uniformly managed through `talos task *`.

### Real-time Monitoring
`talos task status` supports `--watch` / `--no-watch` options, enabled by default for continuous monitoring.

### Git Worktree Integration
Uses worktree mode by default to isolate task environments, supports lock files to prevent concurrent conflicts.

### Interactive PRD Multi-Select
`talos task start` supports interactive multi-select for incomplete PRDs for batch task creation.

### PRD Session Management
`talos prd` supports session persistence for resuming interrupted conversations:

```bash
talos prd                 # Create new PRD session (shows session ID)
talos prd --session <id>   # Resume previous PRD session
talos prd --list           # List all PRD sessions
talos prd --delete <id>    # Delete a PRD session
```

Sessions are stored in `~/.talos/sessions/prd/` and map user-friendly IDs to Claude Code's native session persistence.

## Debug Mode

```bash
talos task start --prd my-feature --debug
talos task resume <taskId> --debug
```

Debug mode logs include the thinking process, tool calls and results, and timestamps.

Log path: `.talos/logs/{taskId}.log`

## More Resources

- [Root CLAUDE.md](../../CLAUDE.md) - Overall project architecture and coding standards
- [@talos/core](../core/CLAUDE.md) - Core package architecture
- [Storage Architecture](../core/docs/STORAGE_ARCHITECTURE.md)
- [Process Management](../core/docs/PROCESS_MANAGEMENT.md)
