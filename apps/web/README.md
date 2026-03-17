# Talos Web

Talos Web Application - Web Interface Layer of the Talos System

## Application Overview

`apps/web` is the Talos system's web application, providing a visual user interface for managing AI-assisted development workflows. Built on Next.js 14 and React 18, using Server Components and App Router architecture.

### Core Responsibilities

- **Web Interface**: Provide a friendly Web UI for managing tasks, PRDs, workspaces, etc.
- **API Services**: Provide RESTful API interfaces for frontend calls
- **Real-time Communication**: Support SSE (Server-Sent Events) for real-time task progress and terminal output push
- **State Management**: Manage application state and server connection state

### Main Features

- **Task Management**: View, create, stop, resume, delete tasks
- **PRD Management**: View, edit, archive Product Requirements Documents
- **Terminal Management**: Web terminal with real-time command execution and output
- **Workspace Management**: View and manage project workspaces
- **System Configuration**: View and modify system configuration
- **Real-time Monitoring**: Real-time display of task execution progress and logs

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18, TailwindCSS
- **State Management**: React Context, Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Real-time Communication**: Server-Sent Events (SSE)
- **Type Safety**: TypeScript

## Project Structure

```
apps/web/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── tasks/            # Task-related APIs
│   │   │   ├── route.ts              # Task list
│   │   │   ├── [taskId]/             # Single task operations
│   │   │   │   ├── route.ts          # Task details
│   │   │   │   ├── status.ts         # Task status
│   │   │   │   ├── logs.ts           # Task logs
│   │   │   │   ├── stream.ts         # Task progress stream
│   │   │   │   ├── resume.ts         # Resume task
│   │   │   │   └── remove.ts         # Delete task
│   │   │   └── ...
│   │   ├── terminal/          # Terminal-related APIs
│   │   │   ├── shell.ts               # Create terminal session
│   │   │   ├── [worktreeId]/         # Worktree operations
│   │   │   │   └── stream.ts          # Terminal output stream
│   │   │   └── command-history.ts     # Command history
│   │   ├── prds/              # PRD-related APIs
│   │   │   ├── route.ts               # PRD list
│   │   │   ├── [id]/                  # Single PRD operations
│   │   │   │   ├── route.ts           # PRD details
│   │   │   │   ├── stats.ts           # PRD statistics
│   │   │   │   └── stories/           # User stories
│   │   │   │       └── [storyId]/
│   │   │   │           └── commits.ts  # Story commit records
│   │   │   └── ...
│   │   ├── config/            # Configuration APIs
│   │   ├── roles/             # Role management APIs
│   │   └── ...
│   └── layout.tsx             # Root layout
├── components/               # React components
│   ├── providers/            # Context Providers
│   ├── ui/                   # UI components
│   └── ...
├── lib/                      # Utility libraries
│   ├── ui/                   # UI state management
│   └── ...
└── public/                   # Static assets
```

## API Endpoints

### Task Management APIs

#### GET /api/tasks
Get all tasks list

**Response Example**:
```json
{
  "tasks": [
    {
      "id": "task-123",
      "prdId": "prd-456",
      "status": "running",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /api/tasks
Create new task

**Request Body**:
```json
{
  "prdId": "prd-456",
  "workingDir": "/path/to/project"
}
```

#### GET /api/tasks/[taskId]/status
Get task status

#### GET /api/tasks/[taskId]/logs
Get task logs

#### GET /api/tasks/[taskId]/stream
Subscribe to task progress stream (SSE)

#### POST /api/tasks/[taskId]/resume
Resume task

#### DELETE /api/tasks/[taskId]/remove
Delete task

### Terminal Management APIs

#### POST /api/terminal/shell
Create terminal session

**Request Body**:
```json
{
  "worktreeId": "worktree-123",
  "workingDir": "/path/to/project"
}
```

#### GET /api/terminal/[worktreeId]/stream
Subscribe to terminal output stream (SSE)

#### GET /api/terminal/command-history
Get command history

### PRD Management APIs

#### GET /api/prds
Get all PRDs

**Response Example**:
```json
{
  "prds": [
    {
      "id": "prd-456",
      "name": "my-feature",
      "status": "in-progress",
      "totalStories": 10,
      "completedStories": 5
    }
  ]
}
```

#### GET /api/prds/[id]
Get PRD details

#### GET /api/prds/[id]/stats
Get PRD statistics

#### GET /api/prds/[id]/stories/[storyId]/commits
Get user story commit records

### Configuration Management APIs

#### GET /api/config
Get system configuration

#### PUT /api/config
Update system configuration

**Request Body**:
```json
{
  "key": "value"
}
```

## Usage Examples

### Start Development Server

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Visit http://localhost:3000
```

### Build Production Version

```bash
# Build production version
pnpm build

# Start production server
pnpm start
```

### Call APIs

```typescript
// Get task list
const response = await fetch('/api/tasks');
const data = await response.json();
console.log(data.tasks);

// Create new task
const response = await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prdId: 'prd-456',
    workingDir: '/path/to/project'
  })
});

// Subscribe to task progress (SSE)
const eventSource = new EventSource('/api/tasks/task-123/stream');
eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Progress update:', update);
};
```

## Architecture Design

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│               User Browser                               │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────┐
│            apps/web (Entry Layer)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  React UI    │  │ API Routes   │  │  SSE Streams │  │
│  │(Frontend UI) │  │(API Service) │  │(Real-time)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/Socket
                         ▼
┌─────────────────────────────────────────────────────────┐
│            @talos/core (Application Layer)              │
│              Talos Daemon Process                        │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Operation** → React UI component
2. **UI Component** → API Routes (Next.js)
3. **API Routes** → Talos daemon process (via Socket or direct call)
4. **Talos** → Execute business logic, return result
5. **API Routes** → Return JSON response or SSE stream
6. **React UI** → Update interface state

### Real-time Communication

- **SSE (Server-Sent Events)**: For one-way push like task progress, terminal output
- **HTTP Polling**: For status queries (fallback option)
- **WebSocket**: May be used for bidirectional communication in the future

## State Management

### React Context

```typescript
// ServerStatusContext - Server connection state
const { status, connected } = useServerStatus();

// LayoutContext - Layout state
const { sidebarOpen, toggleSidebar } = useLayout();

// ErrorContext - Error handling
const { error, showError } = useError();
```

### TanStack Query

```typescript
// Use React Query to manage server state
const { data: tasks, isLoading } = useQuery({
  queryKey: ['tasks'],
  queryFn: () => fetch('/api/tasks').then(r => r.json())
});

// Use Mutation to execute operations
const createTask = useMutation({
  mutationFn: (data) => fetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  })
});
```

## Error Handling

### API Error Response

```typescript
// Error response format
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Frontend Error Handling

```typescript
// Use ErrorProvider to display errors
import { useError } from '@/components/providers/ErrorProvider';

const { showError } = useError();

try {
  await createTask.mutateAsync(data);
} catch (error) {
  showError('Failed to create task', error);
}
```

## Development Guide

### Add New API Endpoint

1. Create corresponding route file in `app/api/`
2. Implement Route Handler (GET, POST, PUT, DELETE)
3. Call `@talos/core` APIs or communicate with Talos daemon process
4. Return JSON response

Example:
```typescript
// app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Call business logic
    const data = await fetchFromTalos();

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 }
    );
  }
}
```

### Add New UI Component

1. Create component file in `components/`
2. Use TypeScript to define Props types
3. Use TailwindCSS for styling
4. Manage state through Context or Hooks

Example:
```typescript
// components/my-component.tsx
'use client';

import { useState } from 'react';

export function MyComponent() {
  const [value, setValue] = useState('');

  return (
    <div className="p-4 bg-white rounded">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border rounded px-2 py-1"
      />
    </div>
  );
}
```

## Dependencies

```
apps/web
├── @talos/core (core functionality package)
├── @talos/types (shared type definitions)
├── next (Next.js framework)
├── react (React library)
└── tanstack-query (data fetching)
```

## Related Packages

- [@talos/core](../../packages/core) - Core functionality package
- [@talos/types](../../packages/types) - Shared type definitions
- [@talos/cli](../../packages/cli) - CLI tools

## More Information

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Main Project Documentation](../../README.md) - Overall project description
