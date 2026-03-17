# @talos/executor

AI Tool Executor Package - Anti-Corruption Layer for Talos System, Encapsulating AI Coding Tool Complexity

## Package Overview

`@talos/executor` is the AI tool execution layer of the Talos system, responsible for interacting with AI coding tools (Claude Code, Cursor). As the system's anti-corruption layer, it isolates API changes from external AI tools and provides a unified execution interface for upper-level applications.

### Core Responsibilities

- **AI Tool Abstraction**: Provide unified tool execution interface, shielding differences between AI tools
- **Stream Output Parsing**: Parse AI tool stream output, extract structured data
- **Tool Adapters**: Provide adapter implementations for different AI tools
- **Error Handling**: Unified handling of AI tool exceptions and errors

## Main Features

### RalphExecutor - Unified Execution Interface

RalphExecutor is the core executor providing the unified PRD execution interface:

```typescript
import { RalphExecutor } from '@talos/executor';

const executor = new RalphExecutor({
  tool: 'claude', // or 'cursor'
  prdPath: '/path/to/prd.json',
  workingDir: '/path/to/project'
});

// Execute PRD
await executor.execute();

// Listen for progress
executor.on('progress', (update) => {
  console.log('Progress update:', update);
});

// Get result
const result = await executor.getResult();
```

### Tool Adapters

#### ClaudeExecutor - Claude Code Adapter

Encapsulates Claude Code invocation logic:

```typescript
import { ClaudeExecutor } from '@talos/executor';

const claude = new ClaudeExecutor({
  prdPath: '/path/to/prd.json',
  workingDir: '/path/to/project',
  debug: true // Enable debug mode
});

await claude.execute();
```

**Features**:
- Supports all Claude Code parameters
- Real-time stream output parsing
- Debug mode support (captures complete execution process)
- Error handling and retry mechanism

#### CursorExecutor - Cursor Adapter

Encapsulates Cursor invocation logic:

```typescript
import { CursorExecutor } from '@talos/executor';

const cursor = new CursorExecutor({
  prdPath: '/path/to/prd.json',
  workingDir: '/path/to/project'
});

await cursor.execute();
```

**Features**:
- Supports all Cursor parameters
- Compatible with Cursor output format
- Unified error handling

### StreamJSONParser - Stream Output Parser

Parses AI tool stream JSON output:

```typescript
import { StreamJSONParser } from '@talos/executor';

const parser = new StreamJSONParser();

// Parse stream data
const stream = getAIOutputStream();
for await (const chunk of stream) {
  const parsed = parser.parse(chunk);
  if (parsed) {
    console.log('Parsed result:', parsed);
  }
}
```

**Features**:
- Supports incomplete JSON fragments
- Automatic JSON object reassembly
- Error recovery mechanism

### ToolExecutorFactory - Tool Factory

Create corresponding tool executors based on configuration:

```typescript
import { ToolExecutorFactory } from '@talos/executor';

const executor = ToolExecutorFactory.create({
  tool: 'claude', // Automatically selects ClaudeExecutor
  prdPath: '/path/to/prd.json',
  workingDir: '/path/to/project'
});

await executor.execute();
```

## Architecture Design

```
┌─────────────────────────────────────────────────────────┐
│          Application Layer                               │
│                    TaskManager                           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           @talos/executor (Anti-Corruption Layer)       │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────┐ │
│  │RalphExecutor │  │ToolExecutorFactory│  │StreamJSON│ │
│  │(Unified I/F) │  │  (Tool Factory)  │  │  Parser  │ │
│  └──────┬───────┘  └──────────────────┘  └──────────┘ │
└─────────┼────────────────────────────────────────────────┘
          │
          ├─────────────┬──────────────┐
          ▼             ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │Claude    │  │Cursor    │  │ Future   │
    │Executor  │  │Executor  │  │ Tools... │
    └──────────┘  └──────────┘  └──────────┘
          │             │              │
          ▼             ▼              ▼
    ┌──────────────────────────────────────────┐
    │         External AI Tools                 │
    │  (Claude Code CLI, Cursor CLI, etc.)     │
    └──────────────────────────────────────────┘
```

## Usage Examples

### Basic Usage

```typescript
import { RalphExecutor } from '@talos/executor';

// 1. Create executor
const executor = new RalphExecutor({
  tool: 'claude',
  prdPath: './ralph/my-feature/prd.json',
  workingDir: '/path/to/project'
});

// 2. Execute PRD
await executor.execute();

// 3. Get execution result
const result = await executor.getResult();
console.log('Execution status:', result.status);
console.log('Completed user stories:', result.completedStories);
```

### Monitor Execution Progress

```typescript
import { RalphExecutor } from '@talos/executor';

const executor = new RalphExecutor({
  tool: 'claude',
  prdPath: './ralph/my-feature/prd.json',
  workingDir: '/path/to/project'
});

// Listen for progress updates
executor.on('story:started', (story) => {
  console.log(`Started: ${story.title}`);
});

executor.on('story:completed', (story) => {
  console.log(`Completed: ${story.title}`);
});

executor.on('story:failed', (story, error) => {
  console.error(`Failed: ${story.title}`, error);
});

await executor.execute();
```

### Debug Mode

```typescript
import { RalphExecutor } from '@talos/executor';

const executor = new RalphExecutor({
  tool: 'claude',
  prdPath: './ralph/my-feature/prd.json',
  workingDir: '/path/to/project',
  debug: true // Enable debug mode
});

await executor.execute();

// In debug mode, logs include complete execution process
// Including thinking, tool calls, tool returns, etc.
```

### Custom Tool Adapter

```typescript
import { ToolExecutor } from '@talos/executor';

class CustomToolExecutor extends ToolExecutor {
  async execute(): Promise<void> {
    // Implement custom tool execution logic
  }

  protected parseOutput(output: string): any {
    // Implement custom output parsing
  }
}

// Register custom tool
ToolExecutorFactory.register('custom-tool', CustomToolExecutor);

// Use custom tool
const executor = new RalphExecutor({
  tool: 'custom-tool',
  prdPath: './ralph/my-feature/prd.json',
  workingDir: '/path/to/project'
});

await executor.execute();
```

## Error Handling

```typescript
import { RalphExecutor, ExecutorError } from '@talos/executor';

const executor = new RalphExecutor({
  tool: 'claude',
  prdPath: './ralph/my-feature/prd.json',
  workingDir: '/path/to/project'
});

try {
  await executor.execute();
} catch (error) {
  if (error instanceof ExecutorError) {
    console.error('Executor error:', error.message);
    console.error('Error type:', error.type);
    console.error('Recovery suggestion:', error.recovery);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Dependencies

```
@talos/executor
├── @talos/types (shared type definitions)
├── @talos/core (logging, configuration management)
└── External AI tools (Claude Code CLI, Cursor CLI)
```

## Related Packages

- [@talos/core](../core) - Core functionality package
- [@talos/types](../types) - Shared type definitions
- [@talos/cli](../cli) - CLI tools

## More Information

- [Development Guide](./CLAUDE.md) - Package architecture and development standards (to be created)
- [Main Project Documentation](../../README.md) - Overall project description
