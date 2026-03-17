# @talos/terminal

Terminal Management Wrapper Package - Anti-Corruption Layer for Talos System, Encapsulating Terminal Operation Complexity

## Package Overview

`@talos/terminal` is the terminal management wrapper layer of the Talos system, providing terminal session management, command processing, WebSocket server, and other functionality. As the system's anti-corruption layer, it isolates terminal operation complexity and provides a unified terminal management API for upper-level applications.

### Core Responsibilities

- **Terminal Session Management**: Create, manage, and destroy terminal sessions
- **Command Processing**: Handle terminal command input and output
- **WebSocket Communication**: Provide real-time terminal data transmission
- **Cache Management**: Cache terminal session data to improve performance

## Main Features

### SessionManager - Session Manager

SessionManager is responsible for managing the terminal session lifecycle:

```typescript
import { SessionManager } from '@talos/terminal';

const sessionManager = new SessionManager();

// Create session
const session = await sessionManager.create({
  worktreeId: 'worktree-123',
  workingDir: '/path/to/project',
  shell: '/bin/zsh'
});

// Get session
const session = await sessionManager.get('session-id');

// Delete session
await sessionManager.remove('session-id');

// List all sessions
const sessions = await sessionManager.list();
```

**Main Methods**:
- `create(options)` - Create new terminal session
- `get(sessionId)` - Get specified session
- `remove(sessionId)` - Delete session
- `list()` - List all sessions
- `exists(sessionId)` - Check if session exists

### CommandHandler - Command Handler

CommandHandler is responsible for handling terminal command execution:

```typescript
import { CommandHandler } from '@talos/terminal';

const handler = new CommandHandler({
  sessionId: 'session-id',
  workingDir: '/path/to/project'
});

// Execute command
const result = await handler.execute('ls -la');
console.log('Output:', result.stdout);
console.log('Error:', result.stderr);

// Write input
await handler.writeInput('echo "hello"\n');

// Resize terminal
await handler.resize({ cols: 80, rows: 24 });
```

**Main Methods**:
- `execute(command)` - Execute command
- `writeInput(input)` - Write input to terminal
- `resize(size)` - Resize terminal
- `kill()` - Terminate command execution

### WsServer - WebSocket Server

WsServer provides a WebSocket server for real-time terminal data transmission:

```typescript
import { WsServer } from '@talos/terminal';

const wsServer = new WsServer({
  port: 3000
});

// Start server
await wsServer.start();

// Listen for connections
wsServer.on('connection', (ws, sessionId) => {
  console.log('New connection:', sessionId);
});

// Listen for messages
wsServer.on('message', (sessionId, data) => {
  console.log('Received message:', data);
});

// Send message
await wsServer.send('session-id', { type: 'output', data: 'hello' });

// Broadcast message
await wsServer.broadcast({ type: 'notification', data: 'update' });

// Stop server
await wsServer.stop();
```

**Main Methods**:
- `start()` - Start WebSocket server
- `stop()` - Stop server
- `send(sessionId, data)` - Send message to specified session
- `broadcast(data)` - Broadcast message to all connections
- `disconnect(sessionId)` - Disconnect specified session

### TerminalCache - Terminal Cache

TerminalCache provides terminal session data caching functionality:

```typescript
import { TerminalCache } from '@talos/terminal';

const cache = new TerminalCache();

// Set cache
await cache.set('session-id', {
  output: 'command output',
  status: 'running'
});

// Get cache
const data = await cache.get('session-id');

// Delete cache
await cache.delete('session-id');

// Clear all cache
await cache.clear();
```

**Main Methods**:
- `set(key, value)` - Set cache
- `get(key)` - Get cache
- `delete(key)` - Delete cache
- `clear()` - Clear all cache
- `has(key)` - Check if cache exists

### History - Command History

History manages command history records:

```typescript
import { History } from '@talos/terminal';

const history = new History({
  sessionId: 'session-id',
  maxSize: 1000 // Maximum history records
});

// Add command
await history.add('ls -la');

// Get history records
const commands = await history.list();

// Search history records
const results = await history.search('ls');

// Clear history
await history.clear();
```

**Main Methods**:
- `add(command)` - Add command to history
- `list()` - Get all history records
- `search(keyword)` - Search history records
- `clear()` - Clear history records

## Architecture Design

```
┌─────────────────────────────────────────────────────────┐
│          Application Layer                               │
│              TaskManager, Web UI                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│          @talos/terminal (Anti-Corruption Layer)        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │SessionManager│  │CommandHandler│  │   WsServer   │  │
│  │(Session Mgmt)│  │(Command Proc)│  │  (WebSocket) │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  │
│  │TerminalCache │  │   History    │  │   Constants  │  │
│  │(Cache Mgmt)  │  │(Cmd History) │  │(Const Defs)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               Underlying System Calls                    │
│          (Node.js child_process, ws)                    │
└─────────────────────────────────────────────────────────┘
```

## Usage Examples

### Basic Usage - Create Terminal Session

```typescript
import { SessionManager } from '@talos/terminal';

const sessionManager = new SessionManager();

// 1. Create session
const session = await sessionManager.create({
  worktreeId: 'worktree-123',
  workingDir: '/path/to/project',
  shell: '/bin/zsh',
  env: {
    NODE_ENV: 'development'
  }
});

console.log('Session ID:', session.id);
console.log('PID:', session.pid);
```

### Execute Commands

```typescript
import { CommandHandler } from '@talos/terminal';

const handler = new CommandHandler({
  sessionId: 'session-id',
  workingDir: '/path/to/project'
});

// 1. Execute command
const result = await handler.execute('ls -la');
console.log('Exit code:', result.exitCode);
console.log('Output:', result.stdout);

// 2. Write input
await handler.writeInput('echo "hello world"\n');

// 3. Resize terminal
await handler.resize({ cols: 120, rows: 30 });
```

### WebSocket Real-time Communication

```typescript
import { WsServer, SessionManager } from '@talos/terminal';

// 1. Create WebSocket server
const wsServer = new WsServer({ port: 3000 });
await wsServer.start();

// 2. Listen for connections
wsServer.on('connection', (ws, sessionId) => {
  console.log('Client connected:', sessionId);

  // Listen for client messages
  ws.on('message', (data) => {
    console.log('Received message:', data.toString());
  });
});

// 3. Send terminal output
wsServer.send('session-id', {
  type: 'output',
  data: 'command output'
});

// 4. Disconnect connection
wsServer.disconnect('session-id');
```

### Command History Management

```typescript
import { History } from '@talos/terminal';

const history = new History({
  sessionId: 'session-id',
  maxSize: 1000
});

// 1. Add commands to history
await history.add('git status');
await history.add('git add .');
await history.add('git commit -m "feat: add feature"');

// 2. Get all history
const commands = await history.list();
console.log('Command history:', commands);

// 3. Search history
const results = await history.search('git');
console.log('Search results:', results);

// 4. Clear history
await history.clear();
```

### Cache Management

```typescript
import { TerminalCache } from '@talos/terminal';

const cache = new TerminalCache();

// 1. Set cache
await cache.set('session-id', {
  output: 'command output',
  status: 'running',
  timestamp: Date.now()
});

// 2. Get cache
const data = await cache.get('session-id');
if (data) {
  console.log('Cached data:', data);
}

// 3. Check if cache exists
if (await cache.has('session-id')) {
  console.log('Cache exists');
}

// 4. Delete cache
await cache.delete('session-id');

// 5. Clear all cache
await cache.clear();
```

## Error Handling

```typescript
import { SessionManager, TerminalError } from '@talos/terminal';

const sessionManager = new SessionManager();

try {
  const session = await sessionManager.create({
    worktreeId: 'worktree-123',
    workingDir: '/path/to/project'
  });
} catch (error) {
  if (error instanceof TerminalError) {
    console.error('Terminal error:', error.message);
    console.error('Error type:', error.type);
    console.error('Session ID:', error.sessionId);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Type Definitions

```typescript
// Session information
interface TerminalSession {
  id: string;
  pid: number;
  worktreeId: string;
  workingDir: string;
  shell: string;
  createdAt: Date;
  status: 'running' | 'stopped' | 'failed';
}

// Command execution result
interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

// WebSocket message
interface WsMessage {
  type: 'output' | 'input' | 'resize' | 'status';
  sessionId: string;
  data: any;
}
```

## Constant Definitions

```typescript
import { TERMINAL_CONSTANTS } from '@talos/terminal';

console.log('Default Shell:', TERMINAL_CONSTANTS.DEFAULT_SHELL);
console.log('Default terminal columns:', TERMINAL_CONSTANTS.DEFAULT_COLS);
console.log('Default terminal rows:', TERMINAL_CONSTANTS.DEFAULT_ROWS);
console.log('Max cache size:', TERMINAL_CONSTANTS.MAX_CACHE_SIZE);
```

## Dependencies

```
@talos/terminal
├── @talos/types (shared type definitions)
├── ws (WebSocket library)
└── Node.js child_process (child process management)
```

## Related Packages

- [@talos/core](../core) - Core functionality package
- [@talos/types](../types) - Shared type definitions
- [@talos/git](../git) - Git operations wrapper

## More Information

- [Constant Definitions](./src/constants.ts) - Constant definitions
- [Test Files](./src/*.test.ts) - Unit test examples
- [Main Project Documentation](../../README.md) - Overall project description
