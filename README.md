# MCP Proxy

Per-tool filtering proxy for Claude Code MCP servers.

## Install

Copy this directory to `~/.claude/plugins/mcp-proxy/`.

In Claude Code `.mcp.json`, replace direct server URLs with:
```json
{ "proxy": { "type": "http", "url": "http://localhost:3100/mcp" } }
```

Put your MCP server configs in `~/.claude/mcp-proxy.json` (see `examples/mcp-proxy.json`).

## Usage

Edit `~/.claude/mcp-proxy.json` to control which tools are visible.
Changes take effect immediately (hot-reload via chokidar).

```bash
# Start manually (normally auto-started by Claude Code SessionStart hook)
node scripts/proxy-server.mjs
```
