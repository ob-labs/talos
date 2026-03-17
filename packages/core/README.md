# @talos/core

Talos Core Functionality Library - Provides process management, storage, communication, and other core capabilities

## Package Overview

`@talos/core` is the core functionality package of the Talos system, providing process management, logging system, storage abstraction, Socket communication, and other foundational capabilities. It adopts a layered architecture design, follows the dependency inversion principle, and provides stable core services for upper-level applications (CLI, Web).

### Core Features

- **Layered Architecture**: Clear separation of application, domain, and infrastructure layers
- **Process Management**: Unified process lifecycle management (spawn, stop, health checks)
- **Storage Abstraction**: Unified storage interface, supporting both global and project storage
- **Socket Communication**: Real-time bidirectional communication with event subscription and message push
- **Logging System**: Tiered logging, automatic rotation, task-specific logs

### Architectural Advantages

- **Single Responsibility**: Each class has clear responsibilities, avoiding functional coupling
- **Dependency Inversion**: Application layer depends on interfaces, not concrete implementations
- **Anti-Corruption Layer**: Encapsulates external complexity (Git, Terminal, AI executors)
- **Testability**: Interface abstractions facilitate mocking and unit testing

## Quick Start

### Installation

```bash
pnpm add @talos/core
```

### StorageManager Usage

StorageManager is the unified entry point for UI-level storage operations:

```typescript
import { StorageManager } from '@talos/core';

// Create instance
const storage = new StorageManager();

// UI state operations
const uiState = await storage.getUIProcessState();
await storage.setUIProcessState({ pid: 1234, port: 3000, startTime: Date.now() });
await storage.clearUIProcessState();

// Access underlying storage directly
const worktreeStorage = storage.getWorktreeStorage();
const progressManager = storage.getProgressManager();
```

### Talos Process Management

```typescript
import { Talos } from '@talos/core';

const talos = new Talos();
await talos.start();

// Start task
const processId = await talos.startTask('prd-123', '/path/to/project');

// Stop task
await talos.stopTask(processId);
```

### TaskManager Usage

```typescript
import { TaskManager } from '@talos/core';

const taskManager = new TaskManager();
await taskManager.start('prd-123', '/path/to/project');
```

## Core Functionality

### StorageManager - Unified Storage Entry

**Responsibilities**:
- Manage UI state storage
- Provide access to WorktreeStorage and ProgressManager

**Does Not Include**:
- ❌ Business logic (process management, task stopping, etc.)
- ❌ Any operations unrelated to file I/O

**API Examples**:

```typescript
// UI state operations
await storage.getUIProcessState();
await storage.setUIProcessState({ pid, port, startTime });
await storage.clearUIProcessState();

// Direct access to underlying storage
storage.getWorktreeStorage();
storage.getProgressManager();
storage.getBasePath();
```

### Talos - Process Manager

Parent process manager, responsible for:
- Starting/stopping/resuming child processes
- Receiving child process Socket notifications
- Executing state transition validation
- Health checks and zombie process detection

### TaskManager - Task Manager

Child process task manager, responsible for:
- PRD execution
- Worktree management
- Process state management
- Session management

## Architecture Design

### Layered Architecture

```
┌─────────────────────────────────────────┐
│         Talos / TaskManager            │
│     Business Logic Layer                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         StorageManager                  │
│      UI State Storage Layer             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Storage Classes                    │
│       Storage Implementation Layer       │
└─────────────────────────────────────────┘
```

### Responsibility Separation

- **StorageManager**: Only responsible for file I/O and data aggregation
- **Talos/TaskManager**: Responsible for business logic and process management

## Documentation

- [Development Guide (CLAUDE.md)](./CLAUDE.md) - Package architecture, coding standards
- [Storage Architecture Design](./docs/STORAGE_ARCHITECTURE.md) - Storage system design
- [Process Management Guide](./docs/PROCESS_MANAGEMENT.md) - Process maintenance and troubleshooting
- [System Service Installation](./docs/SERVICE_INSTALL.md) - Daemon service configuration

## Related Packages

- [@talos/cli](../cli) - CLI tools
- [@talos/git](../git) - Git operations wrapper
- [@talos/terminal](../terminal) - Terminal management
- [@talos/types](../types) - Shared type definitions
