# @talos/logger

Unified Logging Service - Talos System Logging Utility Package

## Package Overview

`@talos/logger` is the unified logging service of the Talos system, providing simple, dependency-free logging functionality with automatic log rotation. This is a lightweight logging tool that can be used by any `@talos` package without creating circular dependencies.

### Core Features

- **Simple to Use**: Clean API, works out of the box
- **Log Levels**: Supports info, warn, error levels
- **Automatic Rotation**: Automatically rotates when log file exceeds specified size
- **Retention Policy**: Configurable number of backup files to retain
- **No Dependencies**: Zero external dependencies, only uses Node.js built-in modules

## Quick Start

### Installation

```bash
pnpm add @talos/logger
```

### Basic Usage

```typescript
import { Logger } from '@talos/logger';

const logger = new Logger({ logPath: '/var/log/daemon.log' });

await logger.info('Daemon started');
await logger.warn('High memory usage detected');
await logger.error('Failed to connect to service');
```

### Using Factory Function

```typescript
import { createLogger } from '@talos/logger';

const logger = createLogger({
  logPath: '~/.talos/daemon.log',
  maxSize: 5 * 1024 * 1024,  // 5MB
  maxFiles: 5                  // Keep 5 backup files
});
```

## Configuration Options

### LoggerOptions

| Parameter | Type | Required | Default | Description |
|------|------|------|--------|------|
| `logPath` | `string` | Yes | - | Log file path |
| `maxSize` | `number` | No | `10MB` | Maximum log file size (bytes) |
| `maxFiles` | `number` | No | `3` | Number of backup files to retain |

## Log Format

Logs are output in the following format:

```
[YYYY-MM-DD HH:mm:ss] [LEVEL] message
```

Example:

```
[2024-03-17 14:30:45] [INFO] Daemon started
[2024-03-17 14:30:46] [WARN] High memory usage detected
[2024-03-17 14:30:47] [ERROR] Failed to connect to service
```

## Log Rotation

When the log file size exceeds `maxSize`, automatic log rotation is performed:

```
daemon.log       → daemon.log.1
daemon.log.1     → daemon.log.2
daemon.log.2     → daemon.log.3
daemon.log.3     → (deleted if maxFiles=3)
```

## API Reference

### Logger Class

#### Constructor

```typescript
constructor(options: LoggerOptions)
```

#### Methods

- `async info(message: string): Promise<void>` - Log info level message
- `async warn(message: string): Promise<void>` - Log warning level message
- `async error(message: string): Promise<void>` - Log error level message

### Factory Function

```typescript
function createLogger(options: LoggerOptions): Logger
```

## Usage Examples

### Daemon Logging

```typescript
import { Logger } from '@talos/logger';

const daemonLogger = new Logger({
  logPath: '~/.talos/daemon.log',
  maxSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 5
});

await daemonLogger.info('Talos daemon started');
```

### Task Logging

```typescript
import { Logger } from '@talos/logger';

const taskLogger = new Logger({
  logPath: `.talos/logs/task-123.log`
});

await taskLogger.info('Task started');
await taskLogger.info('Story 1/10 completed');
await taskLogger.error('Story 2 failed: Connection timeout');
```

### Logging with Context

```typescript
import { Logger } from '@talos/logger';

const logger = new Logger({ logPath: './app.log' });

async function processTask(taskId: string) {
  await logger.info(`Processing task: ${taskId}`);
  try {
    // ... task processing logic
    await logger.info(`Task ${taskId} completed`);
  } catch (error) {
    await logger.error(`Task ${taskId} failed: ${error.message}`);
  }
}
```

## Related Packages

- [@talos/core](../core) - Core functionality package
- [@talos/cli](../cli) - CLI tools
