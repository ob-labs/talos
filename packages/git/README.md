# @talos/git

Git Operations Wrapper Package - Anti-Corruption Layer for Talos System, Encapsulating Git Operation Complexity

## Package Overview

`@talos/git` is the Git operations wrapper layer of the Talos system, providing a type-safe Git operation interface. As the system's anti-corruption layer, it isolates the complexity of Git command-line tools and provides a unified Git operation API for upper-level applications.

### Core Responsibilities

- **Git Operation Abstraction**: Provide unified Git operation interface, shielding Git command complexity
- **Worktree Management**: Dedicated worktree management functionality, supporting multi-task parallel development
- **Type Safety**: Complete TypeScript type definitions, compile-time type checking
- **Error Handling**: Unified handling of Git operation errors and exceptions

## Main Features

### GitService - Git Service Entry

GitService is the core service class providing the unified entry point for all Git operations:

```typescript
import { GitService } from '@talos/git';

const gitService = new GitService('/path/to/repo');

// Get repository root
const rootPath = gitService.getRepositoryRoot();

// Get current branch
const branch = await gitService.getCurrentBranch();

// Create worktree
const worktree = await gitService.createWorktree({
  branch: 'feature/new-feature',
  path: '/path/to/worktree'
});
```

### GitRepository - Repository Operations

Encapsulates Git repository-level operations:

```typescript
import { GitRepository } from '@talos/git';

const repo = new GitRepository('/path/to/repo');

// Get repository root
const rootPath = repo.getRootPath();

// Get current branch
const branch = await repo.getBranch();

// Check if it's a Git repository
const isGitRepo = await repo.isGitRepository();
```

**Main Methods**:
- `getRootPath()` - Get repository root directory
- `getBranch()` - Get current branch name
- `isGitRepository()` - Check if it's a Git repository
- `getRemotes()` - Get remote repository list
- `getCommit(hash)` - Get commit information

### GitWorktree - Worktree Management

Dedicated worktree management functionality:

```typescript
import { GitWorktree } from '@talos/git';

const worktree = new GitWorktree('/path/to/repo');

// Create worktree
await worktree.create({
  branch: 'feature/new-feature',
  path: '/path/to/worktree'
});

// List all worktrees
const worktrees = await worktree.list();

// Remove worktree
await worktree.remove('/path/to/worktree');

// Get worktree information
const info = await worktree.getInfo('/path/to/worktree');
```

**Main Methods**:
- `create(options)` - Create new worktree
- `list()` - List all worktrees
- `remove(path)` - Remove specified worktree
- `getInfo(path)` - Get worktree details
- `prune()` - Clean up invalid worktrees

**Worktree Lock Management**:
```typescript
// Check if worktree is locked
const isLocked = await worktree.isLocked('/path/to/worktree');

// Get lock file path
const lockFile = worktree.getLockFile('/path/to/worktree');

// Unlock worktree (use with caution)
await worktree.unlock('/path/to/worktree');
```

### GitBranch - Branch Operations

Encapsulates Git branch operations:

```typescript
import { GitBranch } from '@talos/git';

const branch = new GitBranch('/path/to/repo');

// List all branches
const branches = await branch.list();

// Create new branch
await branch.create('feature/new-feature', 'main');

// Delete branch
await branch.delete('feature/old-feature');

// Switch branch
await branch.checkout('main');
```

**Main Methods**:
- `list()` - List all branches (local and remote)
- `create(name, base)` - Create new branch
- `delete(name)` - Delete branch
- `checkout(name)` - Switch branch
- `getCurrent()` - Get current branch
- `exists(name)` - Check if branch exists

### GitCommit - Commit Operations

Encapsulates Git commit operations:

```typescript
import { GitCommit } from '@talos/git';

const commit = new GitCommit('/path/to/repo');

// Get latest commit
const latest = await commit.getLatest();

// Get specific commit
const specific = await commit.get('abc123');

// Get commit history
const history = await commit.getHistory({ limit: 10 });

// Get commit diff
const diff = await commit.getDiff('abc123', 'def456');
```

**Main Methods**:
- `getLatest()` - Get latest commit
- `get(hash)` - Get commit by hash
- `getHistory(options)` - Get commit history
- `getDiff(from, to)` - Get diff between two commits
- `getChangedFiles(from, to)` - Get changed file list

### GitRemote - Remote Repository Operations

Encapsulates Git remote repository operations:

```typescript
import { GitRemote } from '@talos/git';

const remote = new GitRemote('/path/to/repo');

// Get remote repository list
const remotes = await remote.list();

// Add remote repository
await remote.add('upstream', 'https://github.com/user/repo.git');

// Get remote repository URL
const url = await remote.getUrl('origin');

// Get remote branch list
const branches = await remote.getBranches('origin');
```

**Main Methods**:
- `list()` - List all remote repositories
- `add(name, url)` - Add remote repository
- `remove(name)` - Remove remote repository
- `getUrl(name)` - Get remote repository URL
- `getBranches(name)` - Get branch list of remote repository

## Architecture Design

```
┌─────────────────────────────────────────────────────────┐
│          Application Layer                               │
│              TaskManager, Talos                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            @talos/git (Anti-Corruption Layer)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  GitService  │  │GitRepository │  │  GitWorktree │  │
│  │(Service Entry)│ │(Repo Ops)    │  │(Worktree Mgmt)│  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  │
│  │  GitBranch   │  │  GitCommit   │  │  GitRemote   │  │
│  │(Branch Ops)  │  │(Commit Ops)  │  │(Remote Ops)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 Git Command Line Tools                   │
│              (git, git worktree, etc.)                   │
└─────────────────────────────────────────────────────────┘
```

## Usage Examples

### Basic Usage

```typescript
import { GitService } from '@talos/git';

// 1. Create Git service instance
const git = new GitService('/path/to/repo');

// 2. Get repository information
const rootPath = git.getRepositoryRoot();
const currentBranch = await git.getCurrentBranch();

console.log('Repository root:', rootPath);
console.log('Current branch:', currentBranch);
```

### Worktree Management

```typescript
import { GitWorktree } from '@talos/git';

const worktree = new GitWorktree('/path/to/repo');

// Create worktree
await worktree.create({
  branch: 'feature/new-feature',
  path: '/path/to/worktree'
});

// List all worktrees
const worktrees = await worktree.list();
console.log('All worktrees:', worktrees);

// Remove worktree
await worktree.remove('/path/to/worktree');
```

### Branch Operations

```typescript
import { GitBranch } from '@talos/git';

const branch = new GitBranch('/path/to/repo');

// Create new branch
await branch.create('feature/new-feature', 'main');

// Switch branch
await branch.checkout('feature/new-feature');

// List all branches
const branches = await branch.list();
console.log('All branches:', branches);
```

### Commit Operations

```typescript
import { GitCommit } from '@talos/git';

const commit = new GitCommit('/path/to/repo');

// Get latest commit
const latest = await commit.getLatest();
console.log('Latest commit:', latest);

// Get commit history
const history = await commit.getHistory({ limit: 10 });
console.log('Commit history:', history);
```

### Scan Worktree

```typescript
import { WorktreeScanner } from '@talos/git';

const scanner = new WorktreeScanner('/path/to/repo');

// Scan all worktrees
const worktrees = await scanner.scan();

console.log('Found worktrees:');
worktrees.forEach(w => {
  console.log(`- ${w.branch}: ${w.path} (${w.status})`);
});
```

## Error Handling

```typescript
import { GitService, GitError } from '@talos/git';

const git = new GitService('/path/to/repo');

try {
  await git.createWorktree({
    branch: 'feature/new-feature',
    path: '/path/to/worktree'
  });
} catch (error) {
  if (error instanceof GitError) {
    console.error('Git error:', error.message);
    console.error('Command:', error.command);
    console.error('Exit code:', error.exitCode);
    console.error('Output:', error.stdout);
    console.error('Error output:', error.stderr);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Type Definitions

```typescript
// Worktree information
interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isLocked: boolean;
  isMain: boolean;
}

// Branch information
interface BranchInfo {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  commit: string;
}

// Commit information
interface CommitInfo {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: string[];
}
```

## Dependencies

```
@talos/git
├── @talos/types (shared type definitions)
└── Git command line tools (system dependency)
```

## Related Packages

- [@talos/core](../core) - Core functionality package
- [@talos/types](../types) - Shared type definitions
- [@talos/terminal](../terminal) - Terminal management (for executing Git commands)

## More Information

- [Type Definitions](./src/types.ts) - Complete TypeScript type definitions
- [Test Files](./src/*.test.ts) - Unit test examples
- [Main Project Documentation](../../README.md) - Overall project description
