# Talos

**[中文文档](docs/README.zh-CN.md)**

Talos is a CLI tool based on Ralph that supports running under Claude Code and Cursor CLI. It enables you to execute multiple Ralph Loop tasks in parallel across multiple repositories.

![Task Monitor](docs/images/task-monitor.png)

## Installation

```bash
# Install globally
npm install -g talos-cli

# Or using pnpm
pnpm add -g talos-cli

# Or using npx (no installation required)
npx talos-cli
```

## Quick Start

### 1. Add Workspace

```bash
talos workspace add
```

### 2. Generate PRD

Create a Product Requirements Document through AI conversation.

```bash
talos prd
# Optional: --tool claude|cursor  --model <model>  (--stream uses the same flags)
```

### 3. Convert PRD

Convert PRD to Ralph format for AI execution.

```bash
talos ralph --prd my-feature
# Optional: --tool claude|cursor  --model <model>
```

### 4. Start Task

Start a task to execute the PRD. Interactive selection is used when no PRD is specified.

```bash
talos task start --prd my-feature
# Optional on start/resume: --tool claude|cursor  --model <model>  [--debug]
```

## Tool and model options

`talos prd`, `talos ralph`, and `talos task` accept **`--tool`** and **`--model`** so you can run with **Claude Code** (default) or **Cursor Agent**.

| Command | Notes |
|--------|--------|
| `talos prd` | Interactive Claude by default; Cursor uses headless `--print` mode. With `--stream`, tool/model apply to the stdio JSON session. |
| `talos ralph` | Headless conversion; supports both tools. |
| `talos task start` / `talos task resume` | Passed through the daemon to the Ralph executor. |

- **`--tool`**: `claude` (default) or `cursor`. For Cursor, set `CURSOR_API_KEY` or run `cursor-agent login` (see `docs/ CURSOR_AGENT_SETUP.zh-CN.md` in this repo).  
- **`--model`**: Optional model id (examples: `sonnet-4`, `opus`; Cursor often `composer-1.5`, `sonnet-4`, or `auto`).

```bash
talos prd --tool cursor --model auto
talos prd --stream --tool claude --model sonnet-4
talos ralph --prd my-feature --tool cursor
talos task start --prd my-feature --tool claude --model sonnet-4
talos task resume my-workspace-my-feature --tool cursor --model composer-1.5
```

## Task Operations

### Monitor Task Progress

```bash
talos task monitor
```

### Attach to Task Working Directory

```bash
talos task attach <taskId> [-f]
```

### Stop Task

```bash
talos task stop <taskId>
```

### Resume Failed Task

```bash
talos task resume <taskId>
```

### Remove Task

```bash
talos task remove <taskId>
```

### Clear Failed Tasks

```bash
talos task clear [--force]
```

## Get Help

```bash
talos --help
talos <command> --help
```

## Complete Command Documentation

For all commands and parameter descriptions: [packages/cli/README.md](packages/cli/README.md)
