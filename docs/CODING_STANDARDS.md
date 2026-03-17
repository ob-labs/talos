# Coding Standards

## Overview

This document consolidates coding rules and best practices scattered throughout the Talos project. Following these standards maintains code consistency, improves maintainability, and reduces bugs.

**Core Principles**:
- ✅ **Clear Architecture** - Layered architecture, clear responsibilities
- ✅ **Clean Code** - Single responsibility, avoid over-abstraction
- ✅ **Type Safety** - Explicit design, fail fast
- ✅ **Documentation Sync** - Update documentation when code changes

## Architectural Principles

### 6-Layer Architecture

Talos adopts a layered architecture, from top to bottom:

```
┌─────────────────────────────────────────────────────────────┐
│  Entry Layer                                                 │
│  - CLI (@talos/cli)                                         │
│  - Web (apps/web)                                           │
│  Responsibility: User interaction, route requests, no business logic │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Anti-Corruption Layer                                      │
│  - Executor (@talos/executor) - AI tool execution           │
│  - Git (@talos/git) - Git operations wrapper                │
│  - Terminal (@talos/terminal) - Terminal management         │
│  Responsibility: Isolate external dependencies, adapter pattern │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Application Layer                                          │
│  - Talos - Main process coordinator                         │
│  - TaskManager - Task management                            │
│  - ConfigManager - Configuration management                 │
│  Responsibility: Orchestrate business flows, coordinate domain objects │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Domain Layer                                               │
│  - Entities (Task, PRD, Story, Workspace)                   │
│  - Repositories (TaskRepository, PRDRepository)             │
│  Responsibility: Encapsulate business logic, rich domain model │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Infrastructure Layer                                       │
│  - ProcessManager - Process management                      │
│  - StorageManager - Storage management                      │
│  - Logger - Logging                                         │
│  - EventBus - Event bus                                     │
│  Responsibility: Provide technical capabilities, no business logic │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Types Layer                                                │
│  - @talos/types - All interface definitions                 │
│  Responsibility: Define contracts, implement dependency inversion │
└─────────────────────────────────────────────────────────────┘
```

**Dependency Rules**:
- ✅ Upper layers depend on lower layer interfaces (via @talos/types)
- ✅ Lower layers don't depend on upper layers
- ✅ No inter-layer dependencies (communicate via event bus)
- ❌ Forbidden reverse dependencies (e.g., infrastructure layer depending on application layer)

### Dependency Inversion Principle

**Principle**: High-level modules should not depend on low-level modules; both should depend on abstractions.

**Implementation**:
1. All interface definitions in `@talos/types`
2. High-level modules inject interface dependencies via constructors
3. Low-level modules implement interfaces

**Example**:
```typescript
// ✅ Correct: Dependency inversion
class TaskManager {
  constructor(
    private taskRepository: ITaskRepository,  // Depend on interface
    private processManager: IProcessManager
  ) {}
}

// ❌ Wrong: Depend on implementation
class TaskManager {
  constructor(
    private taskRepository: TaskRepositoryImpl,  // Depend on concrete implementation
    private processManager: ProcessManagerImpl
  ) {}
}
```

### Single Responsibility Principle

**Principle**: A class should have only one reason to change.

**Checklist**:
- Can this class's responsibility be stated in one sentence?
- Are there multiple unrelated functions?
- Does modifying one function require understanding the entire class?

**Example**:
```typescript
// ❌ Wrong: Mixed responsibilities
class TaskManager {
  async createTask() { /* business logic */ }
  async saveToFile() { /* file operations - not its responsibility */ }
  async spawnProcess() { /* process operations - not its responsibility */ }
}

// ✅ Correct: Clear responsibilities
class TaskManager {
  constructor(private storage: IStorageEngine) {}
  async createTask() { /* Only responsible for business logic */ }
}

class StorageManager {
  async saveToFile() { /* Only responsible for file operations */ }
}

class ProcessManager {
  async spawnProcess() { /* Only responsible for process operations */ }
}
```

### Anti-Corruption Isolation Principle

**Principle**: External dependency changes should not affect core code.

**Implementation**:
- Create anti-corruption layer
- Use adapter pattern to encapsulate external APIs
- Define unified internal interfaces

**Example**:
```typescript
// ✅ Correct: Anti-corruption layer encapsulates AI tool differences
interface IToolExecutor {
  execute(params: ExecuteParams): Promise<ExecuteResult>;
  isAvailable(): boolean;
  stop(): void;
}

class ClaudeExecutor implements IToolExecutor {
  // Encapsulate Claude Code API
}

class CursorExecutor implements IToolExecutor {
  // Encapsulate Cursor API
}

// Core code only depends on IToolExecutor, not concrete implementation
class TaskManager {
  constructor(private executor: IToolExecutor) {}
}
```

### Core Logic First Principle

**Principle**: All core capabilities must be implemented in `@talos/core`, other packages prioritize reuse.

**Core Capabilities**:
- Process management (ProcessManager)
- Logging (Logger)
- Storage (StorageManager)
- Communication (Socket, EventBus)
- Task orchestration (TaskManager)
- Configuration management (ConfigManager)

**Example**:
```typescript
// ❌ Wrong: CLI reimplements core functionality
@talos/cli/src/storage.ts  // Reimplements storage logic

// ✅ Correct: CLI reuses core package
@talos/cli/src/index.ts
import { StorageManager } from '@talos/core';
```

## Code Principles

### 🚨 Unique State Manager Principle (Most Critical - Strictly Forbidden to Violate)

**Core Concept**: **Talos main process is the unique configuration file state manager**

This is the cornerstone of Talos system architecture; violating this principle leads to unexpected bugs.

#### ⛔ Strictly Forbidden Operations

```typescript
// ❌ Forbidden: CLI/Web/other entries directly modify task configuration
await statusManager.createTask(task);              // Forbidden!
await statusManager.updateTask(taskId, updates);   // Forbidden!
await statusManager.setTaskStatus(taskId, status);  // Forbidden!
await fs.writeFile('.talos/config.json', ...);      // Forbidden! Direct config file write
```

#### ✅ Allowed Operations

```typescript
// ✅ CLI/Web: Only send requests, don't write config
const result = await socketClient.send({
  action: "start_task",
  prdId,
  workingDir,
});
// Talos responsible for all state management

// ✅ Talos: Unique state write point
class Talos {
  async startTask(prdId, workingDir) {
    // ✅ Talos creates task
    const task = await this.storageManager.createProjectTask({...});
    // ✅ Talos updates state
    await this.storageManager.updateProjectTask(taskId, { processId, pid });
  }

  async stopTask(taskId) {
    // ✅ Talos stops and updates state
    await this.storageManager.setProjectTaskStatus(taskId, "stopped");
  }
}
```

#### Practice Checklist

**When modifying task state, ask yourself**:
1. Is this executing in the Talos main process?
2. Does Talos already provide the corresponding API?
3. Can you request Talos to execute this operation via Socket communication?

**If answer is no**:
- ❌ Forbidden to directly modify configuration files
- ❌ Forbidden to call storageManager to modify state
- ✅ Request execution via TalosClient

### Clear Responsibility Principle (Important)

**Core Concept**: **Each data/state's read/write operations are the responsibility of a unique class**

**Core Rules**:
- ✅ Each data type has a unique responsible class
- ✅ Modules communicate through interfaces
- ❌ Avoid multiple classes implementing the same file read/write logic

**Example**:
```typescript
// ✅ Correct: Clear responsibilities
class ProcessStateStorage {
  async save(pid: number, state: ProcessState): Promise<void> { /* ... */ }
  async get(pid: number): Promise<ProcessState | null> { /* ... */ }
  async delete(pid: number): Promise<void> { /* ... */ }
}

// All process state operations go through ProcessStateStorage
await processStateStorage.save(pid, state);
const state = await processStateStorage.get(pid);
await processStateStorage.delete(pid);

// ❌ Wrong: Multiple read/write points
// TaskManager directly reads/writes files
await fs.writeFile(`~/.talos/processes/${pid}.json`, ...);
// CLI also directly reads/writes same files
await fs.readFile(`~/.talos/processes/${pid}.json`, ...);
```

### Rich Domain Model

**Principle**: Entities should contain data and behavior, not be anemic models.

**Example**:
```typescript
// ❌ Wrong: Anemic model
class Task {
  status: string;
}

function transitionTo(task: Task, newStatus: string) {
  // State transition logic outside
  if (task.status === "running" && newStatus === "pending") {
    throw new Error("Invalid transition");
  }
  task.status = newStatus;
}

// ✅ Correct: Rich model
class Task {
  private _status: TaskStatus;

  get status(): TaskStatus {
    return this._status;
  }

  transitionTo(newStatus: TaskStatus): void {
    // State transition logic encapsulated inside entity
    if (!this.isValidTransition(this._status, newStatus)) {
      throw new Error(
        `Invalid status transition: ${this._status} -> ${newStatus}`
      );
    }
    this._status = newStatus;
  }

  private isValidTransition(
    current: TaskStatus,
    next: TaskStatus
  ): boolean {
    const validTransitions = {
      running: ["stopped", "failed", "completed"],
      stopped: ["running"],
      // ...
    };
    return validTransitions[current]?.includes(next) ?? false;
  }
}
```

### Complete Persistence Principle

**Principle**: Repository only accepts complete entities, no partial updates.

**Example**:
```typescript
// ❌ Wrong: Partial updates
interface ITaskRepository {
  updateStatus(id: string, status: string): Promise<void>;  // Forbidden
  update(id: string, fields: Partial<Task>): Promise<void>; // Forbidden
}

// ✅ Correct: Complete entities
interface ITaskRepository {
  save(task: Task): Promise<void>;  // Save complete entity
}

// Usage
const task = await repository.getById(id);
task.transitionTo("running");
await repository.save(task);  // Save complete entity
```

### Explicit Design Principle (Fail Fast)

**Principle**: Fail immediately when required parameters are missing, don't use fallback to hide real errors.

**Example**:
```typescript
// ❌ Wrong: Use fallback to hide errors
function createLogPath(repoRoot?: string, workingDir?: string) {
  // If repoRoot missing, fallback to workingDir, hiding real error
  const logPath = path.join(repoRoot || workingDir, ".talos", "logs");
  return logPath;
}

// ✅ Correct: Explicit validation
function createLogPath(repoRoot: string, workingDir: string): string {
  // Explicitly validate required parameters
  if (!repoRoot) {
    throw new Error("repoRoot is required for log path");
  }
  return path.join(repoRoot, ".talos", "logs");
}
```

**Type Definitions**:
```typescript
// ❌ Wrong: Use optional type
function startTask(taskId: string, repoRoot?: string) {
  // repoRoot looks optional but actually required
}

// ✅ Correct: Use required type
function startTask(taskId: string, repoRoot: string) {
  // repoRoot explicitly required
}
```

### Interface Segregation Principle

**Principle**: Interfaces should only define necessary contracts, not include unrelated methods.

**Example**:
```typescript
// ❌ Wrong: Interface too large
interface IManager {
  createTask(): Promise<void>;
  deleteTask(): Promise<void>;
  startProcess(): Promise<number>;
  stopProcess(): Promise<void>;
  saveFile(): Promise<void>;
  readFile(): Promise<string>;
}

// ✅ Correct: Interface segregation
interface ITaskManager {
  createTask(): Promise<void>;
  deleteTask(): Promise<void>;
}

interface IProcessManager {
  startProcess(): Promise<number>;
  stopProcess(): Promise<void>;
}

interface IStorageEngine {
  saveFile(): Promise<void>;
  readFile(): Promise<string>;
}
```

### Naming Conventions

**General Rules**:
- Class names: PascalCase (`TaskManager`, `ProcessManager`)
- Functions/Methods: camelCase (`createTask`, `startProcess`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- Interfaces: Start with `I` (`ITaskRepository`, `IProcessManager`)
- Type aliases: PascalCase (`TaskStatus`, `ProcessId`)
- Private members: Start with underscore (`_status`, `_processId`)

**File Naming**:
- Source files: kebab-case (`task-manager.ts`, `process-manager.ts`)
- Test files: Same as source file + `.test.ts` (`task-manager.test.ts`)
- Config files: kebab-case (`tsconfig.json`, `package.json`)

## Infrastructure Principles

### Process Management

**Principle**: Return identifiers not references, avoid holding process handles.

**Example**:
```typescript
// ❌ Wrong: Return ProcessHandle
interface IProcessManager {
  spawn(command: string): Promise<ProcessHandle>;  // Holding reference
}

// ✅ Correct: Return pid
interface IProcessManager {
  spawn(command: string): Promise<number>;  // Return identifier
}
```

**Reason**:
- ProcessHandle may become invalid after process ends
- pid is a stable process identifier
- Avoid memory leaks (uncleaned process references)

### Atomic Operations

**Principle**: Write operations must use atomic writes, avoid file corruption.

**Example**:
```typescript
// ❌ Wrong: Direct write
async writeJSON(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// ✅ Correct: Atomic write
async writeJSON(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, filePath);  // Atomic operation
}
```

### Protocol Version Management

**Principle**: Communication protocols must be versioned, support backward compatibility.

**Example**:
```typescript
interface ProtocolMessage {
  version: "1.0";  // Protocol version
  action: string;
  payload: unknown;
}

// Handle different versions
class ProtocolManager {
  handleMessage(message: unknown) {
    const msg = message as ProtocolMessage;
    if (msg.version === "1.0") {
      return this.handleV1(msg);
    }
    throw new Error(`Unsupported protocol version: ${msg.version}`);
  }
}
```

### Unified Logging

**Principle**: Use unified logging interface and format.

**Interface Definition**:
```typescript
interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  audit(message: string, meta?: Record<string, unknown>): void;
}
```

**Log Format**:
```
[2026-03-16T10:30:45.123Z] [INFO] Task started
[2026-03-16T10:30:46.456Z] [ERROR] Task failed: Connection timeout
[2026-03-16T10:30:47.789Z] [AUDIT] User performed critical action
```

**Usage Rules**:
- `info` - General information messages
- `warn` - Warnings (don't affect operation)
- `error` - Errors (need attention)
- `audit` - Audit logs (critical operations, must be recorded)

### Event-Driven

**Principle**: Modules communicate via event bus, loose coupling.

**Example**:
```typescript
// Define events
interface TaskStartedEvent {
  type: "task.started";
  taskId: string;
  timestamp: number;
}

// Publish events
eventBus.publish<TaskStartedEvent>({
  type: "task.started",
  taskId: "task-123",
  timestamp: Date.now(),
});

// Subscribe to events
eventBus.subscribe("task.started", (event) => {
  console.log(`Task ${event.taskId} started`);
});
```

**Event Naming**:
- Use `verb.noun` format: `task.started`, `task.completed`, `process.failed`
- Event type as type field: `type: "task.started"`

## Coding Standards

### ES Modules Rules

**Import Rules**:
```typescript
// ✅ Correct: No file extension
import { foo } from './bar';
import { config } from './config';

// ❌ Wrong: With .js extension
import { foo } from './bar.js';
import { config } from './config.js';

// ✅ Exception: Import non-code resources can have extension
import prdData from './prd.json';
import docs from './README.md';
```

### Path Aliases

**Use `@/` alias for intra-package imports**:
```typescript
// ✅ Correct: Use alias
import { TaskManager } from '@/task-manager';
import { Task } from '@/entities/task';

// ❌ Wrong: Relative path
import { TaskManager } from './task-manager';
import { Task } from '../entities/task';
```

**Cross-package imports**:
```typescript
// ✅ Correct: Use package name
import { Logger } from '@talos/core';
import { ITaskRepository } from '@talos/types';
```

### Testing Conventions

**File Organization**:
```
packages/core/src/
├── task-manager.ts
├── task-manager.test.ts  # Test files in same directory as source
├── entities/
│   ├── task.ts
│   └── task.test.ts
```

**Testing Principles**:
1. Only write unit tests for core classes (rich models, repositories, key services)
2. Use temporary directories for file I/O testing
3. Clean up temporary files after testing

**Example**:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('TaskManager', () => {
  const tempDir = join('/tmp', `task-manager-test-${Date.now()}`);

  beforeEach(async () => {
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create task', async () => {
    const manager = new TaskManager(tempDir);
    const task = await manager.createTask({ title: 'Test' });
    expect(task.id).toBeDefined();
  });
});
```

### Documentation Style

**Principle**: Focus on "why" and "architecture level", avoid specific implementation details.

**Documentation Types**:
1. **Architecture Documentation** - Explain design intent and architectural principles
2. **API Documentation** - Describe interface contracts and usage examples
3. **Guide Documentation** - Provide operation guides and best practices
4. **Refactoring Documentation** - Record refactoring reasons and effects

**Writing Rules**:
- ✅ Describe "why do this" (design intent)
- ✅ Explain module responsibilities and boundaries
- ✅ Provide problem-solving ideas
- ❌ Avoid detailed code implementation (will become outdated)
- ❌ Avoid lengthy code examples (keep key patterns)

**Example**:
```markdown
## TaskManager - Task Lifecycle Management

**Responsibilities**:
- Orchestrate task start, stop, resume
- Coordinate sub-components (Executor, SessionManager, ProgressTracker)
- Manage task state transitions

**Key Design**:
- Obtain all dependencies through dependency injection
- Use event bus to communicate with other modules
- State transition logic encapsulated in Task entity

**Usage Example**:
\`\`\`typescript
const manager = new TaskManager(executor, sessionManager, ...);
await manager.start(task);
\`\`\`
```

## Refactoring Strategy

### Pragmatic Optimization (YAGNI Principle)

**Principle**: Don't design ahead of time for "possible" needs.

**Example**:
```typescript
// ❌ Wrong: Over-abstraction
abstract class BaseExecutorFactory<T, R, C> {
  abstract create(config: C): Executor<T, R>;
}

// ✅ Correct: Simple and direct
class ToolExecutorFactory {
  create(type: 'claude' | 'cursor'): IToolExecutor {
    if (type === 'claude') return new ClaudeExecutor();
    return new CursorExecutor();
  }
}
```

### Avoid Over-Abstraction

**Principle**: Abstract after three repetitions, avoid premature abstraction.

**Example**:
```typescript
// First time: Direct implementation
async startTask(taskId: string) {
  const task = await this.storage.getTask(taskId);
  task.transitionTo('running');
  await this.storage.saveTask(task);
}

// Second time: Copy-paste (in another method)
async resumeTask(taskId: string) {
  const task = await this.storage.getTask(taskId);
  task.transitionTo('running');
  await this.storage.saveTask(task);
}

// Third time: Extract common logic
async startTask(taskId: string) {
  await this.updateTaskStatus(taskId, 'running');
}

async resumeTask(taskId: string) {
  await this.updateTaskStatus(taskId, 'running');
}

private async updateTaskStatus(taskId: string, status: TaskStatus) {
  const task = await this.storage.getTask(taskId);
  task.transitionTo(status);
  await this.storage.saveTask(task);
}
```

### Test Core

**Principle**: Only write unit tests for core classes, don't pursue 100% coverage.

**Core Classes**:
- Rich domain models (Task, PRD, Story, Workspace)
- Repository implementations
- Key services (ProcessManager, StorageManager, Logger)

**No Need to Test**:
- Simple data classes
- Pure adapter code
- Third-party library wrappers (if no business logic)

### Documentation Sync

**Principle**: Update documentation synchronously when code changes.

**Checklist**:
- Add new commands → Update CLI documentation
- Modify public APIs → Update type definitions and API documentation
- Change architecture patterns → Update architecture documentation
- Modify data models → Update type documentation and examples

**Commit Conventions**:
- Use `docs:` commit type
- Code implementation and documentation update in same commit
- Checklist: Code implementation → Update documentation → Commit together

## Commit Conventions

### Conventional Commits Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Refactor
- `chore` - Build/tool changes
- `docs` - Documentation updates
- `test` - Test related

**Scopes**:
- Package name: `core`, `cli`, `executor`, `git`, `terminal`, `web`
- Module name: `talos`, `task-manager`, `process-manager`

**Example**:
```bash
feat(core): add TaskLifecycleManager for task state transitions

- Extract task lifecycle logic from Talos
- Implement state transition validation
- Add unit tests for TaskLifecycleManager

Closes #123
```

**Architecture Constraints**:
- State management related commits must use `refactor(talos):`
- Must describe state change path
- Example: `refactor(talos): move task creation to Talos (CLI → Talos)`

## Quality Check

### Type Checking

**Run type check**:
```bash
pnpm run typecheck
```

**Principles**:
- All code must pass type check
- Don't use `@ts-ignore` or `@ts-nocheck`
- Don't use `any` type (unless necessary, with comments)

### Lint

**Run Lint**:
```bash
pnpm run lint
```

**Principles**:
- All code must pass ESLint check
- Fix lint errors before committing
- Don't use `// eslint-disable-next-line` (unless necessary)

### Testing

**Run tests**:
```bash
pnpm run test
```

**Principles**:
- Core classes must have unit tests
- Tests should be fast and stable
- Don't commit code with failing tests

### Build

**Run build**:
```bash
pnpm run build
```

**Principles**:
- All code must build successfully
- Check build artifact size
- Ensure no unexpected dependencies

## Related Documentation

- **[Architecture Design](./REFACTORING.md)** - Refactoring principles and architecture evolution
- **[Documentation Guidelines](./DOCUMENTATION_GUIDELINES.md)** - How to write project documentation
- **[Data Model Consistency](./DATA_MODEL_CONSISTENCY.md)** - Maintaining data model consistency
- **[Separation of Concerns Guide](./SEPARATION_OF_CONCERNS.md)** - Single responsibility principle in practice
- **[Migration Guide](./MIGRATION_GUIDE.md)** - Migrating from old to new architecture
- **[CLAUDE.md](../CLAUDE.md)** - Claude Code work guide

## Summary

Following these coding standards can:

1. **Maintain code consistency** - Unified naming, structure, style
2. **Improve maintainability** - Clear responsibility boundaries, easy to understand and modify
3. **Reduce bugs** - Explicit design, single state manager, type safety
4. **Increase development efficiency** - Clear architecture, easy to locate problems

**Core Principles**:
- 🚨 **Unique State Manager** (most critical, strictly forbidden to violate)
- ⚠️ **Clear Responsibilities** (important, avoid confusion)
- ✅ **Explicit Design** (Fail Fast)
- ✅ **Layered Architecture** (6-layer dependency relationships)
- ✅ **Rich Domain Model** (business logic encapsulated in entities)
