# Documentation Guidelines

This document explains how to write and maintain technical documentation in the Talos project.

## Core Principles

### ⚠️ Clear Responsibility Principle [Most Important]

**Core Concept**: Each document and each module should have a **single, clear responsibility**.

In documentation writing, reflect clear responsibility:
- ✅ Explicitly state "what this module is responsible for"
- ✅ Explicitly state "what this module is not responsible for"
- ✅ List responsibility boundaries and relationships with other modules
- ❌ Avoid vague descriptions (like "manages related functions")

**Why Important**:
The clarity of documentation responsibilities directly affects the clarity of code responsibilities. If documentation can't clearly state a module's responsibilities, code implementation is more likely to have confused responsibilities.

**Practice Example**:

Good documentation (clear responsibility):
```markdown
## ProcessStateStorage - Process State Storage

**Responsibilities**:
- Read/write operations for process state files
- Lifecycle management of process state

**Not part of this module's responsibilities**:
- Process start/stop (handled by ProcessManager)
- Inter-process communication (handled by SocketManager)

**Dependencies**:
- Uses LocalStorageService for underlying file operations
- Used by ProcessManager, provides state persistence
```

Poor documentation (vague responsibility):
```markdown
## ProcessStateStorage

Responsible for process-related storage operations, including reading/writing state files, managing process data, etc.
```

### Architecture First, Avoid Details

**Most Important Principle**: Technical documentation should describe **architectural-level design intent**, not specific implementation details.

Why?
- ✅ Architectural design is relatively stable, doesn't become outdated
- ❌ Code implementation changes frequently, technical details quickly become inaccurate
- ✅ Understanding "why" is more important than remembering "how"
- ❌ Outdated technical details mislead readers

**Practice Guidance**:

Good documentation example:
```markdown
## Storage Architecture

**Design Philosophy**: Layered storage, clear responsibilities

- **StorageManager**: Unified storage entry, coordinates all storage operations
- **Global storage**: Process state, desired state, workspace configuration
- **Project storage**: Task configuration, user stories, progress logs
```

Poor documentation example:
```markdown
## StorageManager Class

StorageManager has the following methods:
- `saveData(key, value)`: Saves data to localStorage
- `getData(key)`: Gets data from localStorage
- `deleteData(key)`: Deletes data from localStorage

Implementation details:
```typescript
saveData(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value))
}
```
```

### Two Types of Documentation Positioning

Each package in the project should contain two documents, each with clear goals:

#### README.md - User Manual

**Goal**: Help users quickly understand and use the tool

**Content**:
- Quick start steps
- Command/feature list and parameter descriptions
- Solutions to common problems

**Avoid**:
- ❌ Code examples (unless simple command-line usage)
- ❌ Architecture design explanations
- ❌ Development-related content

#### CLAUDE.md - Development Guide

**Goal**: Help developers and AI assistants understand architectural design

**Content**:
- Package positioning and responsibility boundaries
- Core architectural principles
- Dependencies with other packages
- Problem-solving ideas and directions

**Avoid**:
- ❌ Detailed technical implementation (becomes outdated after code changes)
- ❌ Lengthy code examples (keep key patterns only)
- ❌ Content duplicated with root CLAUDE.md

## Documentation Structure Templates

### README.md Template

```markdown
# [Package Name]

Brief description (1-2 sentences explaining package purpose)

## Quick Start

Minimal installation and usage steps

## Features

Features grouped by function

### Feature Group 1
- Feature A: Concise description
- Feature B: Concise description

### Feature Group 2
- Feature C: Concise description

## Command Reference

Commands grouped by function, with parameter descriptions

### Process Management
```bash
talos daemon start    # Start daemon
talos daemon stop     # Stop daemon
```

## FAQ

### Issue: XXX
**Symptom**: What user sees

**Solution**:
1. Step one
2. Step two

## More Information

Links to other related documentation
```

### CLAUDE.md Template

```markdown
# [Package Name] - Development Guide

## Package Positioning and Responsibilities

**Core Responsibilities**:
- Responsibility 1: Concise description
- Responsibility 2: Concise description

**Not part of this package's responsibilities**:
- Feature X: Handled by [other package]
- Feature Y: Handled by [other package]

## Architectural Principles

### Design Principle 1

**Design Intent**: Why design it this way

**Implementation**: High-level description (no specific code)

**Relationship with other modules**:
- Depends on: [other modules]
- Used by: [other modules]

### Design Principle 2

...

## Coding Standards

### Import Rules
- Rule 1
- Rule 2

### Naming Conventions
- Class naming: ...
- Method naming: ...

### Error Handling
- How to handle errors
- Logging standards

## Common Problem Solving

### Problem Symptom

**Troubleshooting Direction**:
1. Check point 1
2. Check point 2

**Related Files**:
- `src/xxx.ts`: File purpose
- `src/yyy.ts`: File purpose

**Related Documentation**: Links
```

## Documentation Maintenance Recommendations

### Update Timing

**When code changes**:
- ✅ Architecture adjustments → Update CLAUDE.md
- ✅ Interface changes → Update README.md
- ✅ New features → Update both documents

**Regular Reviews**:
- Review documentation accuracy after each iteration
- Remove outdated technical details
- Keep core architectural principles

### Documentation Quality Check

When updating documentation, ask yourself:

1. **Is this an architectural-level description?**
   - ✅ Describe design intent and responsibility division
   - ❌ Describe specific API calls or code implementation

2. **Will this information quickly become outdated?**
   - ✅ Focus on stable design principles
   - ❌ Record frequently changing implementation details

3. **Can the reader understand "why"?**
   - ✅ Explain reasons for design decisions
   - ❌ Only list "what is it" and "how to do it"

4. **Is there duplicate content?**
   - ✅ Each document has clear responsibilities, no duplication
   - ❌ Same content described in multiple places

## Real Cases

### Case 1: Storage Architecture Documentation

**Good Practice**:
```markdown
## Storage Architecture

**Design Philosophy**: Layered storage, clear responsibilities

- **StorageManager**: Unified storage entry, coordinates all storage operations
- **Global storage** (~/.talos/): Process state, desired state, workspace configuration
- **Project storage** (.talos/): Task configuration, user stories, progress logs
- **Underlying services**: LocalStorageService provides file operation primitives

**Why design it this way**:
- Separate global and project storage to support multiple workspaces
- Unified entry ensures data consistency
- Abstract underlying services for easy testing and extension
```

**Poor Practice**:
```markdown
## StorageManager

StorageManager class has the following public methods:

```typescript
class StorageManager {
  async saveProcessState(pid: number, state: ProcessState): Promise<void> {
    const path = `${CONFIG_DIR}/processes/${pid}.json`
    await fs.writeFile(path, JSON.stringify(state, null, 2))
  }

  async getProcessState(pid: number): Promise<ProcessState | null> {
    const path = `${CONFIG_DIR}/processes/${pid}.json`
    // ...
  }
}
```

Storage locations:
- Process state: `~/.talos/processes/{pid}.json`
- Desired state: `~/.talos/desired-state.json`
- ...
```

### Case 2: Process Management Documentation

**Good Practice**:
```markdown
## Process Management Architecture

**Design Philosophy**: Parent-child process layered collaboration, unified entry management

- **ProcessManager**: Unified management of all process lifecycles
- **Communication layer**: Socket bidirectional communication, real-time state sync
- **Persistence**: State file records, supports process recovery
- **Cleanup mechanism**: Process group management, ensures complete cleanup

**Key Design Decisions**:
- Use process groups not individual PIDs: ensure entire process tree can be cleaned
- Socket communication not polling: reduce latency, improve real-time performance
- State file persistence: supports state recovery after parent process restart
```

**Poor Practice**:
```markdown
## ProcessManager Usage

Start process:
```typescript
const pm = new ProcessManager()
const pid = await pm.spawn('node', ['script.js'], {
  cwd: '/path/to/dir',
  env: { NODE_ENV: 'production' }
})
```

Stop process:
```typescript
await pm.kill(pid, 'SIGTERM')
// Wait 5 seconds
await sleep(5000)
// If still not stopped, force kill
await pm.kill(pid, 'SIGKILL')
```
```

## Summary

Good technical documentation should:

1. **Explain Design Intent** - Why design it this way
2. **State Responsibility Boundaries** - What this module is responsible for, what it's not
3. **Provide Troubleshooting Ideas** - Where to start when problems occur
4. **Maintain Abstraction Level** - Focus on architecture, not implementation
5. **Avoid Quick Obsolescence** - Record stable principles, not volatile details

Remember: **The purpose of documentation is to help understand the system, not to replace code reading.** When you need to understand specific implementation, you should read the source code directly, not the documentation.
