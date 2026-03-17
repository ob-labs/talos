#!/bin/bash
# Kill orphaned Claude Code subagent processes between Ralph iterations.
#
# Claude Code has a known bug: when Task tool subagents finish, their child
# processes (Node/Bun) get reparented to PID 1 and are never cleaned up.
# Each Ralph iteration spawns new subagents, so orphans accumulate rapidly.
#
# This script targets processes where PPID=1 and command matches Claude/Node
# patterns. MIN_AGE prevents killing active subagents from the current run.
#
# Usage: ./cleanup-claude-orphans.sh [min_age_seconds]
#   min_age_seconds: default 5, minimum age before killing (safety guard)

set -euo pipefail

MIN_AGE="${1:-5}"
LOG_DIR="${CLAUDE_CLEANUP_LOG_DIR:-$HOME/.claude/logs}"
LOG="$LOG_DIR/ralph-cleanup.log"
mkdir -p "$LOG_DIR"

# Match orphaned Claude/Codex subagent roots (PPID=1)
# Patterns: .claude plugins, shell-snapshots, anthropic, codex
ROOT_CMD_REGEX='\.claude/(plugins|shell-snapshots)|@anthropic|@openai/codex|codex --yolo|/claude\s'

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

# Recursively collect descendant PIDs
collect_descendants() {
  local parent="$1" child
  while IFS= read -r child; do
    [[ -z "$child" ]] && continue
    echo "$child"
    collect_descendants "$child"
  done < <(pgrep -P "$parent" 2>/dev/null || true)
}

# Kill root and entire descendant tree
kill_tree() {
  local root="$1"
  local tree
  tree=$( { echo "$root"; collect_descendants "$root"; } | sort -u | awk 'NF')
  [[ -z "$tree" ]] && return
  echo "$tree" | xargs kill -TERM 2>/dev/null || true
  sleep 2
  echo "$tree" | xargs kill -9 2>/dev/null || true
}

# Parse etime (MM:SS, H:MM:SS, D-HH:MM:SS) to seconds
etime_to_seconds() {
  local et="$1" days=0 hours=0 mins=0 secs=0
  [[ "$et" == *-* ]] && { days="${et%%-*}"; et="${et#*-}"; }
  IFS=: read -ra parts <<< "$et"
  case ${#parts[@]} in
    3) hours="${parts[0]}"; mins="${parts[1]}"; secs="${parts[2]}" ;;
    2) mins="${parts[0]}"; secs="${parts[1]}" ;;
    1) secs="${parts[0]}" ;;
  esac
  echo $((days * 86400 + hours * 3600 + mins * 60 + secs))
}

killed=0
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  pid=$(echo "$line" | awk '{print $1}')
  ppid=$(echo "$line" | awk '{print $2}')
  etime=$(echo "$line" | awk '{print $3}')
  cmd=$(echo "$line" | awk '{$1=$2=$3=""; print $0}' | sed 's/^ *//')

  [[ "$ppid" != "1" ]] && continue
  echo "$cmd" | grep -qE "$ROOT_CMD_REGEX" || continue
  echo "$cmd" | grep -q 'cleanup-claude-orphans' && continue

  age=$(etime_to_seconds "$etime")
  [[ "$age" -lt "$MIN_AGE" ]] && continue

  # Kill process and entire descendant tree
  kill_tree "$pid"
  ((killed++)) || true
  echo "$(timestamp) Killed PID $pid (age ${age}s): ${cmd:0:100}" >> "$LOG"
done < <(ps axo pid,ppid,etime,command 2>/dev/null)

if [[ $killed -gt 0 ]]; then
  echo "$(timestamp) Cleanup: $killed orphan processes killed" >> "$LOG"
  echo "  [ralph] Cleaned $killed orphan Claude process(es)"
fi
