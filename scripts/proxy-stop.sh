#!/bin/bash
PORTFILE="$HOME/.claude/mcp-proxy.port"
PORT=$(cat "$PORTFILE" 2>/dev/null || echo "3100")
lsof -ti:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
rm -f "$PORTFILE"
