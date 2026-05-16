#!/bin/bash
set -euo pipefail

PORTFILE="$HOME/.claude/mcp-proxy.port"

# Clean up orphan process from previous session
OLD_PORT=$(cat "$PORTFILE" 2>/dev/null || true)
if [ -n "$OLD_PORT" ]; then
  lsof -ti:$OLD_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
fi
for port in 3100 3101 3102 3103; do
  lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Restart loop — crash → auto-respawn
(
  while true; do
    node "${PLUGIN_ROOT}/scripts/proxy-server.mjs"
    sleep 2
    # Clean up port before restart
    for port in 3100 3101 3102 3103; do
      lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
    done
  done
) &
echo $!
