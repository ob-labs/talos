# Talos Process Management Architecture

## Design Philosophy

### Why Do We Need Process Management?

As an AI-assisted development workflow management system, Talos's core challenge is: **How to reliably manage long-running AI task processes?**

**Key Requirements**:
1. **Persistence**: Task processes run independently of CLI sessions
2. **Observability**: Real-time monitoring of task status and progress
3. **Controllability**: Start, stop, resume tasks at any time
4. **Cleanup Capability**: Ensure complete process tree cleanup, avoid zombie processes

**Architecture Evolution**:
- **Old Architecture**: Use `~/.talos/processes/` directory to store process state files
- **New Architecture**: Unified use of `.talos/config.json` to manage all task states

### Core Design Principles

**1. Single State Manager**
> Talos main process is the unique writer of task configuration

- ✅ Talos main process: Unique entry for all state changes
- ✅ CLI/Web: Only send requests, read and display results
- ❌ Any other entry: Forbidden to directly modify configuration

**2. Unified Process Management**
> ProcessManager encapsulates all underlying process operations

- All process start/stop through ProcessManager
- Use process group management to ensure entire process tree can be cleaned
- Provide process state query and tracking

**3. Layered Responsibilities**
> Each component has clear responsibility boundaries

- **ProcessManager**: Underlying process operations (spawn, stop, isAlive)
- **Talos**: Task orchestration and state management
- **TaskManager**: Execute specific tasks in child process
- **StorageManager**: Unified storage entry

## Architecture Overview

### Process Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                        Talos Main Process                    │
│                        (Daemon)                             │
│                                                              │
│  Responsibilities:                                           │
│  • Task orchestration (startTask, stopTask, resumeTask)     │
│  • State management (unique config writer)                  │
│  • Health checks and zombie process detection               │
│  • Socket communication (receive CLI requests and child     │
│    process notifications)                                   │
│                                                              │
│  Holds:                                                      │
│  • ProcessManager (unified process management)              │
│  • StorageManager (unified storage entry)                   │
│  • SocketServer (Unix Socket server)                        │
└─────────────────────────────────────────────────────────────┘
                        ↓ spawn()
┌─────────────────────────────────────────────────────────────┐
│                   TaskManager Child Process                  │
│                                                              │
│  Responsibilities:                                           │
│  • Execute user stories from PRD                            │
│  • Manage Ralph Executor child process                      │
│  • Notify state changes via Socket                          │
│  • Write task logs and progress                             │
│                                                              │
│  Holds:                                                      │
│  • Independent ProcessManager instance                      │
│  • SocketClient (communicate with Talos)                    │
│  • Task-specific Logger and Storage                         │
└─────────────────────────────────────────────────────────────┘
                        ↓ spawn()
┌─────────────────────────────────────────────────────────────┐
│                   Ralph Executor Grandchild Process          │
│                                                              │
│  Responsibilities:                                           │
│  • Execute specific AI coding tasks                          │
│  • Manage Claude Code and other child processes             │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibility Division

**ProcessManager** (underlying process management):
- Encapsulates Node.js `child_process` API
- Process group management (`createGroup: true`)
- Process state query (`isAlive`)
- PID file operations

**Talos** (main process manager):
- Task lifecycle management (start, stop, resume)
- State transition validation (ensure legal state transitions)
- Health check scheduling (every 10 seconds)
- Zombie process cleanup

**TaskManager** (task executor):
- Runs in independent child process
- Manages Ralph Executor process
- Reports status to parent process via Socket

**StorageManager** (storage management):
- Unified storage entry
- Manages LocalTaskConfig instances
- Provides project-level task queries

### Communication Architecture

**1. Socket Communication (real-time bidirectional)**
```
CLI → Talos:  stop_task, resume_task
Child process → Talos: notify_state_change
```

**2. File Storage (persistence)**
```
.talos/config.json: Task state (single source of truth)
~/.talos/sessions/{id}.sock: Unix Socket file
```

**3. Environment Variables (process startup)**
```
TALOS_PROCESS_ID: Process unique identifier
TALOS_BASE_PATH: Base path
```

## Key Mechanisms

### Process Startup Flow

**Complete Flow**:
```
1. CLI: talos task start --prd <prd-id>
   ↓
2. SocketClient: send({ action: "start_task", prdId, workingDir })
   ↓
3. Talos: startTask()
   ├─ StorageManager.createProjectTask()
   ├─ ProcessManager.spawn("node", [taskManagerPath, ...], {
   │    detached: true,      // Independent process
   │    createGroup: true    // Process group management
   │  })
   └─ LocalTaskConfig.setTaskStatus(taskId, "running")
   ↓
4. TaskManager child process starts
   ├─ Initialize SocketClient
   ├─ Start Ralph Executor
   └─ Notify parent: notify_state_change("running")
   ↓
5. CLI displays task started
```

**Key Design Points**:
- `detached: true`: Child process runs independently, not affected by parent lifecycle
- `createGroup: true`: Create process group, ensure entire process tree can be cleaned
- Socket notification: Child process proactively reports status to parent

### Health Check Mechanism

**Check Period**: Every 10 seconds

**Check Content**:
```typescript
// Talos main process executes periodically
async performHealthChecks() {
  const tasks = await this.storage.getProjectTasks({ repoRoot });

  for (const task of tasks) {
    if (task.status !== 'running') continue;

    // 1. Check if process exists
    const alive = task.processId
      ? await this.checkProcessAlive(task.processId)
      : false;

    // 2. Update health check time
    await this.storage.updateProjectTaskHealthCheck(task.id, { repoRoot });

    // 3. If process died, mark as failed
    if (!alive) {
      await this.storage.setProjectTaskStatus(task.id, 'failed', { repoRoot });
    }
  }
}
```

**Zombie Process Detection**:
```typescript
// Check tasks with status running but process died
const zombieCount = await taskConfig.markZombieProcesses(
  (pid) => this.processManager.isAlive(pid)
);
```

### Process Group Management

**Why Do We Need Process Groups?**

Problem with single process stop:
```
Stop TaskManager process
  ↓
Ralph Executor child process still running
  ↓
Becomes orphaned process, continues consuming resources
```

**Process Group Solution**:
```typescript
// Create process group on startup
const handle = await processManager.spawn("node", [taskManagerPath], {
  detached: true,
  createGroup: true  // Key: Create process group
});

// Kill entire process group on stop
await processManager.stopProcessGroup(leaderPid, "SIGTERM");
// Use negative PID to kill entire process group
```

**Process Group Signal Propagation**:
```
kill(-PGID, SIGTERM)
  ↓
TaskManager (process group leader)
  ├─ Ralph Executor
  │   └─ Claude Code
  └─ Other child processes
  ↓
Entire process tree receives signal, exits in order
```

### State Transition Management

**Legal State Transitions**:
```
stopped → running   (startTask, resumeTask)
running → stopped   (stopTask)
running → completed (natural completion)
running → failed    (abnormal exit)
stopped → running   (resumeTask)
```

**State Transition Validation**:
```typescript
// Talos validates state transition
async validateStateTransition(
  taskId: string,
  from: TaskStatus,
  to: TaskStatus
): Promise<boolean> {
  const task = await this.storage.getProjectTask(taskId, { repoRoot });

  if (task.status !== from) {
    throw new Error(
      `Invalid state transition: ${task.status} → ${to}`
    );
  }

  return true;
}
```

## Troubleshooting Guide

### Debugging Commands List

**1. Find Processes**
```bash
# Find by name
ps aux | grep ralph
pgrep -lf "ralph"

# Find by PID
ps -p 12345 -o pid,ppid,pgid,stat,comm

# View process tree
pstree -p 12345
ps -ef --forest | grep ralph
```

**2. Check Process Status**
```bash
# Process status codes
# S = Sleeping, R = Running, Z = Zombie, T = Stopped
ps -p 12345 -o pid,stat,comm

# Real-time monitoring
watch -n 1 'ps -p 12345 -o pid,stat,comm'
top -p 12345
```

**3. Check Process Groups**
```bash
# View process group ID
ps -p 12345 -o pid,pgid,comm

# View all processes in process group
ps -g 12345 -o pid,pgid,stat,comm

# Kill process group
kill -TERM -12345  # Note the negative sign
```

**4. Check Task Status**
```bash
# View task configuration
cat .talos/config.json | jq

# View specific task
cat .talos/config.json | jq '.tasks[] | select(.id=="task-xxx")'

# View running tasks
talos task list
```

**5. Check Logs**
```bash
# Talos daemon log
tail -f ~/.talos/daemon.log

# Task log
tail -f .talos/logs/task-xxx.log

# Search errors
grep -i "error" ~/.talos/daemon.log
```

**6. Check Socket**
```bash
# View socket files
ls -la ~/.talos/sessions/

# Test socket connection
echo '{"type":"ping"}' | socat - UNIX-CONNECT:~/.talos/sessions/sess-xxx.sock
```

### FAQ

**Q1: Can't find child process on stop**

**Reason**:
- Process exited naturally but state file not updated
- PID in PID file is wrong
- Process killed externally

**Troubleshooting**:
```bash
# 1. Check if process exists
ps -p <pid>

# 2. Check state file
cat .talos/config.json | jq '.tasks[] | select(.processId=="task-xxx")'

# 3. If process doesn't exist, manually cleanup
talos task remove task-xxx
```

**Q2: Task status shows failed but still running**

**Reason**:
- Health check misjudgment
- Socket communication failed
- State file incorrectly updated

**Troubleshooting**:
```bash
# 1. Check real process status
ps -p <pid> -o pid,stat,comm

# 2. Check socket connection
ls -la ~/.talos/sessions/

# 3. If process really running, update status
# Fix status via Talos API
talos task resume task-xxx
```

**Q3: Zombie Process**

**Symptom**:
```bash
ps aux | grep defunct
user  12345  ...  [ralph] <defunct>  # Z = Zombie
```

**Reason**:
- Parent process didn't wait() for child process
- Child process in process group became zombie

**Solution**:
```bash
# 1. View zombie process's parent
ps -o pid,ppid,stat,comm -p 12345

# 2. Restart parent process to let it wait() child
talos restart

# 3. Force kill zombie process
kill -9 12345
```

**Q4: Process Group Leak**

**Symptom**:
```bash
# After stopping main process, child processes still running
talos task stop task-xxx
ps aux | grep ralph  # Still has processes
```

**Reason**:
- Didn't use `createGroup: true`
- Child process created its own children

**Solution**:
```bash
# 1. View process tree
pstree -p <pid>

# 2. Manually kill process group
kill -TERM -<pgid>

# 3. Check if code uses createGroup: true
```

### Quick Diagnostic Script

```bash
#!/bin/bash
# talos-diagnose.sh

echo "=== Talos Process Diagnostic ==="
echo ""

# 1. Check Talos daemon
echo "1. Talos Daemon:"
if [ -f ~/.talos/daemon.pid ]; then
  pid=$(cat ~/.talos/daemon.pid)
  if ps -p $pid > /dev/null 2>&1; then
    echo "  ✓ Daemon running (PID: $pid)"
  else
    echo "  ✗ Daemon not running (PID file exists but process doesn't)"
  fi
else
  echo "  ✗ Daemon not running (PID file doesn't exist)"
fi
echo ""

# 2. Check child processes
echo "2. Child Processes:"
if pgrep -f "task-manager" > /dev/null; then
  echo "  Found task-manager processes:"
  pgrep -f "task-manager" | while read pid; do
    echo "    - PID $pid"
  done
else
  echo "  No task-manager processes found"
fi
echo ""

# 3. Check task status
echo "3. Task Status:"
if [ -f .talos/config.json ]; then
  running=$(cat .talos/config.json | jq '[.tasks[] | select(.status=="running")] | length')
  total=$(cat .talos/config.json | jq '.tasks | length')
  echo "  Total tasks: $total"
  echo "  Running: $running"
else
  echo "  No task configuration found"
fi
echo ""

# 4. Check socket files
echo "4. Socket Files:"
if [ -d ~/.talos/sessions ]; then
  count=$(ls ~/.talos/sessions/*.sock 2>/dev/null | wc -l | tr -d ' ')
  echo "  Found $count socket files"
else
  echo "  No socket directory found"
fi
echo ""

# 5. Check zombie processes
echo "5. Zombie Processes:"
if ps aux | grep -q defunct; then
  echo "  ✗ Found zombie processes"
else
  echo "  ✓ No zombie processes found"
fi
echo ""

echo "=== Diagnostic Complete ==="
```

## Best Practices

### Development Debugging

**Enable Verbose Logging**:
```typescript
const logger = new Logger({
  logPath: '~/.talos/daemon.log',
  level: 'debug'
});
```

**Listen to Process Events**:
```typescript
handle.process.once("exit", (code, signal) => {
  logger.info(`Process exited: code=${code}, signal=${signal}`);
});

handle.process.once("error", (error) => {
  logger.error(`Process error: ${error.message}`);
});
```

### Production Deployment

**Regular Health Checks**: Talos automatically executes every 10 seconds

**Auto Cleanup Zombie Processes**:
```typescript
// Talos executes periodically
setInterval(() => {
  this.performHealthChecks();
}, 10000);
```

**Daemon Auto Restart**: Use systemd
```ini
[Service]
Restart=always
RestartSec=5
```

## Related Documentation

- [Storage Architecture Design](./STORAGE_ARCHITECTURE.md) - Unified storage architecture
- [Main CLAUDE.md](../../CLAUDE.md) - Overall project architecture
- [Separation of Concerns Guide](../../docs/SEPARATION_OF_CONCERNS.md) - Single responsibility principle

## Summary

Core principles of Talos process management:

1. **Single State Manager**: Talos main process is the unique config writer
2. **Unified Process Management**: All process operations through ProcessManager
3. **Process Group Management**: Use `createGroup: true` to ensure entire process tree can be cleaned
4. **State Sync**: Ensure consistency via Socket notifications and health checks
5. **Observability**: Complete logging and monitoring for easy troubleshooting

Following these principles can build a reliable long-running task management system.
