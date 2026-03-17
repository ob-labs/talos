#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Usage: ./ralph.sh [--tool amp|claude] [max_iterations]

set -e

# Trap termination signals to gracefully clean up child processes
# 捕获终止信号以优雅地清理子进程
cleanup() {
  echo ""
  echo "Received termination signal. Cleaning up..."
  # Kill all child processes in the current process group
  # 杀死当前进程组中的所有子进程
  kill -- -$$ 2>/dev/null || true
  exit 1
}

trap cleanup SIGTERM SIGINT

# Parse arguments
TOOL="claude"  # Default to claude
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    *)
      # Assume it's max_iterations if it's a number
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Validate tool choice
if [[ "$TOOL" != "amp" && "$TOOL" != "claude" && "$TOOL" != "cursor" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'amp', 'claude', or 'cursor'."
  exit 1
fi

# Check cursor-agent availability
if [[ "$TOOL" == "cursor" ]]; then
  if ! command -v cursor-agent &> /dev/null; then
    echo "Error: cursor-agent is not installed or not in PATH"
    echo ""
    echo "To use cursor as the tool, you need to install cursor-agent:"
    echo "  https://github.com/getcursor/cursor-agent"
    echo ""
    echo "After installation, make sure cursor-agent is available in your PATH."
    exit 1
  fi
  echo "✓ cursor-agent found: $(command -v cursor-agent)"
fi

# Define maximum prompt length threshold for cursor (100KB)
MAX_PROMPT_LENGTH=100000

# SCRIPT_DIR 是脚本所在目录（CLI 目录），用于读取 CLAUDE.md
# SCRIPT_DIR is the script directory (CLI directory), used for reading CLAUDE.md
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# WORK_DIR 是当前工作目录（用户项目），用于读写项目文件
# WORK_DIR is the current working directory (user project), used for reading/writing project files
WORK_DIR="${PWD:-$(pwd)}"

# 项目文件路径说明
# Project file paths explanation
# - PRD 文件已通过 syncPRDToWorktree 同步到 worktree 的 scripts/ralph/ 目录
# - ralph.sh 在 worktree 中运行，直接读取本地文件即可
# - ARCHIVE_DIR 使用项目根目录的 archive/
# 
# PRD files are synced to worktree'''s scripts/ralph/ directory via syncPRDToWorktree
# ralph.sh runs in worktree, reads local files directly
# ARCHIVE_DIR uses project root'''s archive/

if [ -n "$RALPH_NAME" ]; then
  # 在 worktree 中，从本地 ralph/{RALPH_NAME}/ 目录读取文件
  # In worktree, read files from local scripts/ralph/ directory
  PROJECT_DIR="$WORK_DIR/ralph/$RALPH_NAME"
  PRD_FILE="$PROJECT_DIR/prd.json"
  PROGRESS_FILE="$PROJECT_DIR/progress.txt"

  # ARCHIVE_DIR 需要使用项目根目录（worktree 的上两级）
  # ARCHIVE_DIR should use project root (two levels up from worktree)
  # 检查是否在 worktree 中
  if [ -f "$WORK_DIR/.git" ]; then
    # 在 worktree 中，.git 是文件
    # In worktree, .git is a file
    PROJECT_ROOT="$WORK_DIR/../.."
  else
    # 不在 worktree 中（测试环境）
    # Not in worktree (test environment)
    PROJECT_ROOT="$WORK_DIR"
  fi
  ARCHIVE_DIR="$PROJECT_ROOT/archive"
else
  echo "错误：未设置 RALPH_NAME 环境变量"
  echo "Error: RALPH_NAME environment variable not set"
  exit 1
fi

# 读取当前分支（仅用于显示）
# Read current branch (for display only)
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "Current branch: $CURRENT_BRANCH"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"
echo ""
echo "=== Ralph Environment Debug ==="
echo "Working directory: $(pwd)"
echo "WORK_DIR: $WORK_DIR"
echo "PROJECT_DIR: $PROJECT_DIR"
echo "PROJECT_ROOT: $PROJECT_ROOT"
echo "RALPH_NAME: $RALPH_NAME"
echo ""
echo "PRD_FILE: $PRD_FILE"
echo "PROGRESS_FILE: $PROGRESS_FILE"
echo "ARCHIVE_DIR: $ARCHIVE_DIR"
echo ""
echo "Verifying PRD file exists:"
if [ -f "$PRD_FILE" ]; then
  echo "  ✓ PRD file found"
  echo "  Branch name: $(jq -r '.branchName // "N/A"' "$PRD_FILE" 2>/dev/null || echo "N/A")"
  echo "  Project: $(jq -r '.project // "N/A"' "$PRD_FILE" 2>/dev/null || echo "N/A")"
else
  echo "  ✗ PRD file NOT found at: $PRD_FILE"
fi
echo "=== End Debug ==="
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  # 在循环之前准备替换后的 CLAUDE.md
  # 使用 sed 替换环境变量为实际值
  CLAUDE_PROMPT=$(sed -e "s|\\$PRD_FILE|$PRD_FILE|g" -e "s|\\$PROGRESS_FILE|$PROGRESS_FILE|g" "$SCRIPT_DIR/CLAUDE.md")

  # Check prompt length for cursor (warn if exceeding threshold)
  if [[ "$TOOL" == "cursor" ]]; then
    PROMPT_LENGTH=${#CLAUDE_PROMPT}
    if [[ $PROMPT_LENGTH -gt $MAX_PROMPT_LENGTH ]]; then
      echo ""
      echo "⚠️  Warning: Prompt length ($PROMPT_LENGTH bytes) exceeds recommended threshold for cursor-agent"
      echo "   cursor-agent may have issues with long prompts passed as command-line arguments."
      echo "   Consider using the 'claude' tool for better long-prompt support."
      echo "   Continuing with cursor-agent anyway..."
      echo ""
    fi
  fi

  # Run the selected tool with the ralph prompt
  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(echo "$CLAUDE_PROMPT" | amp --dangerously-allow-all 2>&1 | tee /dev/stderr) || true
  elif [[ "$TOOL" == "cursor" ]]; then
    # cursor-agent: use -p flag for prompt (command-line argument, not stdin)
    OUTPUT=$(cursor-agent -p "$CLAUDE_PROMPT" 2>&1 | tee /dev/stderr) || true
  else
    # Claude Code: use --dangerously-skip-permissions for autonomous operation, --print for output
    OUTPUT=$(echo "$CLAUDE_PROMPT" | claude --dangerously-skip-permissions --print 2>&1 | tee /dev/stderr) || true
  fi

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi

  echo "Iteration $i complete. Continuing..."
  # Claude Code has a known bug: Task tool subagents leave orphaned Node processes
  # (reparented to PID 1) that are never cleaned up. Each iteration accumulates more.
  # Run cleanup between iterations to prevent process buildup.
  if [[ "$TOOL" == "claude" ]] && [[ -x "$SCRIPT_DIR/cleanup-claude-orphans.sh" ]]; then
    sleep 5   # Let previous claude's children fully reparent to PID 1
    "$SCRIPT_DIR/cleanup-claude-orphans.sh" 5
  else
    sleep 2
  fi
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
