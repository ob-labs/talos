# @talos/core - Core Architecture Documentation

## Package Overview

`@talos/core` is the core package of the Talos system, providing process management, logging, storage, communication, and other core functionality.

## Module Structure

```
packages/core/src/
├── entry.ts              # Daemon entry point
├── index.ts              # Package exports
├── application/          # Application layer
│   ├── talos/            # Talos main process management
│   │   ├── Talos.ts              # Talos main class
│   │   ├── SocketServer.ts       # Socket server
│   │   ├── TaskLifecycleManager.ts  # Task lifecycle management
│   │   ├── HealthChecker.ts      # Health checker
│   │   └── UIManager.ts          # UI management
│   └── task-manager/      # Task manager
│       ├── TaskManager.ts         # Task manager main class
│       ├── TaskOrchestrator.ts    # Task orchestrator
│       ├── SessionManager.ts      # Session management
│       ├── ProgressTracker.ts     # Progress tracking
│       ├── AuditLogger.ts         # Audit logging
│       ├── MetricsCollector.ts    # Metrics collection
│       └── UINotifier.ts          # UI notifications
├── domain/               # Domain layer
│   ├── entities/         # Domain entities
│   │   ├── Task.ts               # Task entity
│   │   ├── PRD.ts                # PRD entity
│   │   ├── Story.ts              # User story entity
│   │   ├── Workspace.ts          # Workspace entity
│   │   └── Worktree.ts           # Worktree entity
│   └── repositories/      # Repository interfaces
│       ├── TaskRepository.ts      # Task repository interface
│       └── WorktreeRepository.ts  # Worktree repository interface
├── infrastructure/       # Infrastructure layer
│   ├── communication/    # Communication module
│   │   └── socket/              # Socket communication
│   │       └── ProtocolManager.ts    # Protocol manager
│   ├── events/           # Event module
│   │   └── InMemoryEventBus.ts  # In-memory event bus
│   ├── logging/          # Logging module
│   │   └── LogFormatter.ts      # Log formatter
│   └── process/          # Process module
│       ├── ProcessRegistry.ts    # Process registry
│       └── ProcessExitResult.ts  # Process exit result
├── storage/              # Storage layer
│   ├── storage-manager.ts         # Storage manager
│   ├── storage.ts                # Storage implementation
│   ├── ui-state-storage.ts       # UI state storage
│   ├── prd-manager.ts            # PRD management
│   ├── progress-manager.ts       # Progress management
│   └── ...
├── repositories/         # Repository implementations
│   ├── prd-repository.ts         # PRD repository implementation
│   └── workspace-repository.ts   # Workspace repository implementation
├── process/              # Process management
│   └── ProcessManager.ts         # Process manager
├── logger/               # Logging system
│   ├── index.ts                   # Logging main entry
│   └── task-logger.ts             # Task logger
└── config/               # Configuration management
    └── index.ts                   # Config main entry
```

## Core Classes and Exports

### ProcessManager

Unified process manager encapsulating all underlying process operations (spawn, stop, process group management, process tracking, etc.).

**Detailed Documentation**: [Process Maintenance and Troubleshooting Guide](docs/PROCESS_MANAGEMENT.md)

### Talos Main Class

Parent process manager, responsible for:
- Starting/stopping child processes (via ProcessManager)
- Receiving child process Socket notifications
- Executing state transition validation
- Health checks and zombie process detection
- Logging and auditing

### Logger

Logging system providing file logging, automatic rotation, task-specific logs, and remote logging client.

### Storage

The storage layer adopts a **centralized architecture**, unified through **StorageManager** for all storage operations.

**StorageManager** - Simplified storage entry:
- Manages UI state storage
- Provides access to WorktreeStorage and ProgressManager
- No longer responsible for desired state management (removed)

**Underlying Storage Classes** (still directly accessible, backward compatible):
- PRDManager: PRD file management
- ProgressManager: progress.txt management
- WorktreeStorage: Git worktree storage
- StoryStorage: User story storage
- SimpleTaskStorage: Simple task storage
- WorkspaceSessionStorage: Workspace session storage
- UIStateStorage: UI state storage

**Important Notes**:
- StorageManager **is only responsible for storage operations** (file I/O)
- Business logic (such as stopTask, healthCheck) is in Talos/TaskManager classes
- See: [Storage Architecture Design](./docs/STORAGE_ARCHITECTURE.md)

### TaskManager

Task manager running in child process, responsible for PRD execution, process state management, and session management.

## Architecture Design

### Layered Architecture

`@talos/core` adopts a clear layered architecture, following the Dependency Inversion Principle:

```
┌─────────────────────────────────────────────────────────┐
│          Application Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Talos     │  │ TaskManager  │  │Orchestrator  │  │
│  │(Main Process)│  │(Task Execute)│  │(Task Orchest.)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           Domain Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Task Entity │  │ PRD Entity   │  │ Story Entity │  │
│  │ (Task Entity)│  │(PRD Entity)  │  │(User Story)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│        Infrastructure Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ProcessManager│  │  Logger      │  │StorageManager│  │
│  │(Proc Mgmt)   │  │(Log System)  │  │(Storage Mgmt)│  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  │
│  │SocketServer  │  │EventBus      │  │Repositories  │  │
│  │(Socket Svc)  │  │(Event Bus)   │  │(Data Repos)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           External Dependencies                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ @talos/git   │  │@talos/terminal│ │ @talos/executor│ │
│  │(Git Ops)     │  │(Terminal Mgmt)│ │(AI Executors)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### Application Layer

**Responsibilities**: Orchestrate business flows, coordinate domain objects to complete business use cases

**Main Components**:
- **Talos** - Main process manager, responsible for task lifecycle management, health checks, zombie process cleanup
- **TaskManager** - Task manager, responsible for PRD execution, session management, worktree management
- **TaskOrchestrator** - Task orchestrator, responsible for task execution flow orchestration

**Usage Example**:
```typescript
import { Talos, WorkspaceRepository } from '@talos/core';

// Application layer interacts with infrastructure layer through interfaces
const talos = new Talos();
await talos.start();
const processId = await talos.startTask('prd-123', '/path/to/repo');

// Access workspace data through repositories
const workspaceRepo = new WorkspaceRepository();
const workspace = await workspaceRepo.findByPath('/path/to/repo');
console.log(workspace?.name);
```

#### Domain Layer

**Responsibilities**: Encapsulate core business concepts and business rules, independent of external frameworks

**Main Entities**:
- **Task** - Task entity, contains state transition logic (transitionTo, start, stop, complete, fail)
- **PRD** - Product Requirements Document entity, contains user story list
- **Story** - User story entity, contains acceptance criteria, priority, completion status
- **Workspace** - Workspace entity, represents project working directory

**Design Principles**:
- Domain objects don't depend on infrastructure layer implementation details
- Business logic encapsulated inside entities (e.g., state transition validation)
- Abstract data access through Repository pattern

#### Infrastructure Layer

**Responsibilities**: Provide technical capability support, implement interfaces defined by domain layer

**Main Components**:
- **ProcessManager** - Process management (spawn, stop, process group management)
- **Logger** - Logging system (file logging, automatic rotation, tiered logging)
- **StorageManager** - Unified storage entry (manages all storage operations)
- **SocketServer/Client** - Socket communication (real-time bidirectional communication)
- **LocalStorage** - File storage (atomic writes, file operation primitives)

**Key Features**:
- Implement interfaces defined by domain layer (such as IProcessManager, IStorageEngine)
- Provide replaceable technical implementations (facilitates testing and extension)
- Encapsulate external system complexity (such as file system, process system)

#### Dependencies

**External packages depended upon by core package**:
- **@talos/git** - Git operations wrapper (GitService, WorktreeManager)
- **@talos/terminal** - Terminal management (SessionManager, CommandHandler)
- **@talos/executor** - AI tool executors (RalphExecutor, ToolExecutorFactory)

**Dependency Inversion**:
- Application layer depends on domain layer interfaces, not concrete implementations
- Domain layer defines interfaces, infrastructure layer provides implementations
- External packages (git, terminal, executor) encapsulate external complexity through anti-corruption layer

### Parent-Child Process Architecture

```
Talos (Parent Process)
  ├── Uses ProcessManager to manage all process operations
  ├── Communicates via Socket
  ├── Holds Logger instance (~/.talos/talos.log)
  └── Holds Storage instance

TaskManager (Child Process)
  ├── Uses ProcessManager to start child tasks
  ├── Notifies state changes via Socket
  ├── Holds its own Logger (.talos/logs/{taskId})
  └── Instantiates its own Storage
```

### Communication Mechanisms

1. **Socket Communication**: Real-time bidirectional communication
2. **Configuration Files**: Task state persistence (.talos/config.json)
3. **Environment Variables**: Pass configuration to child processes

## Usage Examples

```typescript
import { Talos, Logger, ProcessManager, TaskManager, PRDManager } from '@talos/core';

// ProcessManager
const processManager = new ProcessManager();
const handle = await processManager.spawn('node', ['script.js'], {
  detached: true,
  createGroup: true
});

// Talos
const talos = new Talos();
await talos.start();

// Logger
const logger = new Logger({ logPath: '~/.talos/talos.log' });
await logger.info('Daemon started');

// Storage
const prdManager = new PRDManager();
const prd = await prdManager.getPRD('my-prd');

// TaskManager
const taskManager = new TaskManager();
await taskManager.start('my-prd', '/path/to/project');
```

## Related Documentation

- [Process Maintenance and Troubleshooting Guide](docs/PROCESS_MANAGEMENT.md) - Process management architecture, problem troubleshooting, shell commands
- [Main CLAUDE.md](../../CLAUDE.md) - Overall project architecture
- [System Service Installation Guide](./docs/SERVICE_INSTALL.md) - Talos daemon installation
- [TaskManager Usage Guide](./src/task-manager/skill.md) - Task management detailed documentation
