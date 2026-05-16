---
name: mcp-proxy
description: Use when managing MCP tool visibility, enabling or disabling specific tools, or checking tool configuration
---

# MCP Proxy

The MCP Proxy filters which tools are visible to Claude Code. Edit `~/.claude/mcp-proxy.json` to control tool visibility.

## Managing Tools

- Enable tool: set to `"on"` in config
- Disable tool: set to `"off"` in config
- `defaultMode` controls new tools not explicitly configured

## Config Location

`~/.claude/mcp-proxy.json`
