# Talos Storage Architecture Design

## Design Philosophy

### Why Do We Need a Unified Storage Architecture?

As a multi-process system, Talos faces a core challenge: **How to maintain state consistency across multiple processes?**

**Lessons Learned**:
In early architecture, state storage was scattered in multiple places:
- CLI directly reads/writes `.talos/config.json`
- Talos main process also reads/writes the same file
- TaskManager child process also tries to modify state

**Serious Problems Caused**:
1. **Race Conditions**: Multiple processes writing simultaneously cause data overwrites
2. **State Inconsistency**: Memory state out of sync with file state
3. **Difficult to Trace**: Cannot determine who modified the state
4. **Hard to Debug Bugs**: Don't know which entry point caused the problem

### Core Design Principles

**Single State Manager Principle**:
> Talos main process is the unique writer of configuration file state

This means:
- ✅ Talos main process: Responsible for all state changes
- ✅ CLI/Web: Only send requests, read and display results
- ❌ Any other entry: Forbidden to directly modify configuration files

**Clear Responsibility Principle**:
> Each data type's read/write operations are the responsibility of a unique class

This means:
- ✅ Each storage class has clear responsibility boundaries
- ✅ All operations go through unified entry point
- ❌ Avoid multiple classes implementing the same file read/write logic

## Storage Layer Structure

Talos adopts a two-level storage architecture: global storage + project storage

```
Storage Layers
├── Global storage (~/.talos/)
│   ├── workspaces.json        # Workspace list
│   ├── ui-state.json          # UI process state
│   ├── talos.sock             # Socket communication file
│   ├── talos.log              # Daemon log
│   └── sessions/              # Session state
│       └── {sessionId}.json
│
└── Project storage (.talos/)
    ├── config.json            # Task configuration (core)
    ├── ralph/                 # PRD files
    │   └── {prdName}/
    │       ├── prd.json       # PRD definition
    │       └── archive/       # Archived PRDs
    └── logs/                  # Task logs
        └── {taskId}.log
```

### Global Storage: ~/.talos/

**Purpose**: Cross-project global state and configuration

**Core Files**:
- `workspaces.json` - Workspace list
- `ui-state.json` - UI process state (PID, port)
- `talos.sock` - Socket communication file
- `talos.log` - Daemon running log
- `sessions/` - Session state files

**Access Characteristics**:
- Shared across multiple projects
- Managed by Talos main process
- CLI/Web can read but should not directly write

### Project Storage: .talos/

**Purpose**: Project-specific task state and metadata

**Core Files**:
- `config.json` - Task state (most critical)
- `ralph/` - PRD definitions and archives
- `logs/` - Task execution logs

**Access Characteristics**:
- Independent for each project
- Managed by Talos main process
- Single source of truth for task state

## Core Components

### StorageManager - Unified Storage Entry

**Responsibilities**:
- Manage UI state storage
- Provide access to WorktreeStorage and ProgressManager

**Design Pattern**: Facade pattern

**Key Features**:
1. **Singleton Pattern**: Globally unique instance
2. **Unified Interface**: Hides underlying storage details
3. **Type Safety**: Provides complete TypeScript types

**Usage Example**:
```typescript
import { StorageManager } from '@talos/core';

const storage = new StorageManager();

// UI state operations
await storage.getUIProcessState();
await storage.setUIProcessState({ pid: 1234, port: 3000, startTime: Date.now() });
await storage.clearUIProcessState();

// Directly access underlying storage
const worktreeStorage = storage.getWorktreeStorage();
const progressManager = storage.getProgressManager();
```

### WorkspaceRepository - Workspace Storage

**Responsibilities**:
- Manage workspace list
- Stored in `~/.talos/workspaces.json`

**Data Model**:
```typescript
interface Workspace {
  id: string;
  name: string;
  path: string;
  branch: string;
  worktrees: string[];
  terminals: TerminalSession[];
  expanded: boolean;
}
```

### UIStateStorage - UI State Storage

**Responsibilities**:
- Manage UI server process state
- Store UI configuration

**Data Model**:
```typescript
interface UIProcessState {
  pid: number;
  port: number;
  startTime: number;
}

interface UIConfig {
  // UI configuration options
}
```

### PRDManager - PRD File Management

**Responsibilities**:
- Manage PRD files (ralph/ directory)
- Provide CRUD operations
- Handle PRD archiving

### ProgressManager - Progress Management

**Responsibilities**:
- Manage progress.txt file
- Track user story execution progress

## Data Model Consistency

### State Synchronization Mechanism

Talos ensures data consistency through the following mechanisms:

**1. Single Write Point**
```
All state changes → Talos main process → StorageManager → Repository → Storage file
```

**2. Health Check Probing**
```
Every 10 seconds → Talos checks process alive → Update lastHealthCheck → Mark zombie processes
```

**3. Socket Notification**
```
Child process state change → Socket notify → Talos validates → Update config file
```

### Data Flow Diagram

**Task Start Flow**:
```
CLI: talos task start
  ↓
SocketClient.send({ action: "start_task", prdId })
  ↓
Talos: startTask()
  ↓
Repository / Storage
  ↓
.talos/config.json (write)
  ↓
ProcessManager.spawn()
  ↓
Return result to CLI
```

**State Update Flow**:
```
Child process: notifyStateChange()
  ↓
Socket: notify { processId, status }
  ↓
Talos: handleStateChange()
  ↓
Validate if state transition is valid
  ↓
Repository / Storage
  ↓
.talos/config.json (write)
```

### Zombie Process Detection

**Detection Mechanism**:
```typescript
// Talos executes periodically
for (const task of runningTasks) {
  if (task.pid && !isAlive(task.pid)) {
    // Process died but status still running
    await repository.updateTaskStatus(task.id, 'failed');
  }
}
```

## Best Practices

### ✅ Recommended Practices

**1. All State Operations Through Repository**
```typescript
// ✅ Correct
const workspaceRepo = new WorkspaceRepository();
await workspaceRepo.save(workspace);

// ❌ Wrong: Directly use underlying storage
const storage = new LocalStorageEngine('~/.talos');
await storage.writeJSON('workspaces.json', data);
```

**2. CLI/Web Only Send Requests**
```typescript
// ✅ Correct: CLI only sends requests
const result = await socketClient.send({
  action: "start_task",
  prdId
});

// ❌ Wrong: CLI directly modifies configuration
await fs.writeFile('.talos/config.json', ...);
```

**3. Talos Is Unique Writer**
```typescript
// ✅ Correct: Execute in Talos
class Talos {
  async startTask(prdId: string) {
    const task = await this.taskOrchestrator.start(prdId);
    // ... execute task
  }
}

// ❌ Wrong: Write directly in CLI
class CLI {
  async startTask(prdId: string) {
    await repository.createTask(task);  // Forbidden!
  }
}
```

### ❌ Forbidden Operations

**1. Forbidden Multi-Entry Writes**
```typescript
// ❌ Strictly forbidden
CLI: await repository.setTaskStatus(taskId, 'running');
Talos: await repository.setTaskStatus(taskId, 'stopped');
// → Race condition!
```

**2. Forbidden Bypass Repository**
```typescript
// ❌ Strictly forbidden
await fs.writeFile('.talos/config.json', JSON.stringify(data));
// → Bypassed state management logic!
```

**3. Forbidden Modify Config in Child Process**
```typescript
// ❌ Strictly forbidden
class TaskManager {
  async updateMyStatus() {
    await this.repository.updateTaskStatus(this.id, 'completed');
    // → Child process should not modify configuration!
  }
}

// ✅ Correct: Notify parent process via Socket
class TaskManager {
  async updateMyStatus() {
    await this.socketClient.notify({
      type: 'state_change',
      processId: this.id,
      status: 'completed'
    });
  }
}
```

## FAQ

### Q1: Why Can't CLI Directly Modify Configuration?

**A**: Because multi-process concurrent writes cause:
1. **Data Race**: Two processes writing simultaneously, last write wins
2. **State Inconsistency**: Talos memory state out of sync with file state
3. **Difficult to Debug**: Don't know who modified the state

### Q2: What If Talos Crashes?

**A**:
1. **Config File Persistence**: .talos/config.json retains complete state
2. **Daemon Auto Restart**: systemd or other daemon manager
3. **Recover on Startup**: Talos reads config on startup, restores state

### Q3: How to Verify State Consistency?

**A**: Use health check mechanism:
```typescript
// Talos executes periodically
setInterval(async () => {
  const tasks = await taskRepository.findByStatus('running');
  for (const task of tasks) {
    if (task.pid) {
      const alive = processManager.isAlive(task.pid);
      if (!alive) {
        // State inconsistent, fix
        await taskRepository.updateTaskStatus(task.id, 'failed');
      }
    }
  }
}, 10000);
```

### Q4: How to Migrate Old Data?

**A**: Repository has built-in data migration:
```typescript
private migrateTask(task: any): Task {
  // If already has new fields, return directly
  if (task.prd && task.branch) return task;

  // Migrate old data
  return {
    ...task,
    prd: task.feat || task.prd,
    branch: task.feat?.startsWith('ralph/') ? task.feat : `ralph/${task.feat}`
  };
}
```

## Related Documentation

- [Process Management Architecture](./PROCESS_MANAGEMENT.md) - Process lifecycle management
- [Main CLAUDE.md](../../CLAUDE.md) - Overall project architecture
- [Data Model Consistency](../../docs/DATA_MODEL_CONSISTENCY.md) - Data model design principles

## Summary

Core principles of Talos storage architecture:

1. **Single State Manager**: Talos main process is the unique state writer
2. **Clear Responsibilities**: Each storage class has clear responsibility boundaries
3. **Unified Entry**: All storage operations through Repository and StorageManager
4. **State Sync**: Ensure consistency through health checks and Socket notifications
5. **Data Persistence**: All critical state stored in file system

Following these principles avoids the most common state inconsistency issues in multi-process systems.
