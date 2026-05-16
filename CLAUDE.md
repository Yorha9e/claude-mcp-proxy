# MCP Proxy — Tool Registry Gateway for Claude Code

## What It Is

A local proxy that sits between Claude Code and MCP servers. CC connects to `localhost:3100/mcp` instead of directly to each MCP server. The proxy:

1. **Filters tools by whitelist** — only tools set to `"on"` in config are visible to CC
2. **Slims schemas** — tool schemas reduced ~90% (keep param names + types, drop descriptions/defaults/icons)
3. **Auto-discovers new MCPs** — when `claude mcp add` adds a server, proxy detects and adds to its config
4. **Forwards calls transparently** — `tools/call` passes through to backend, all real work done by backend

## Why

MCP servers often expose 50-300+ tools. CC loads ALL tool schemas into context at session start. No per-tool toggle exists. This proxy is a user-space workaround.

## Architecture

```
Claude Code → localhost:3100/mcp (proxy) → GitHub API (api.githubcopilot.com/mcp/)
                                                   → (future) Playwright MCP
                                                   → (future) any MCP
```

## Files

```
mcp-proxy/
├── plugin.json              # CC plugin manifest
├── README.md                # Quick start
├── hooks/hooks.json         # SessionStart + Stop hooks
├── skills/mcp-proxy/SKILL.md
├── scripts/
│   ├── proxy-server.mjs     # Main server (HTTP + MCP protocol + auto-discovery)
│   ├── proxy-start.sh       # Called by SessionStart hook (kill orphans + start + watchdog loop)
│   └── proxy-stop.sh        # Called by Stop hook
├── src/
│   ├── config-loader.mjs    # Load/parse ~/.claude/mcp-proxy.json with ENV substitution
│   ├── cache.mjs            # In-memory tool cache with TTL + staleMode + SSE parsing
│   ├── tool-filter.mjs      # Whitelist filter + slimSchema stripping
│   └── router.mjs           # JSON-RPC 2.0 handler (initialize, tools/list)
└── examples/
    └── mcp-proxy.json       # Sample config
```

## Deploy

```bash
cp -r mcp-proxy ~/.claude/plugins/
claude mcp add proxy --transport http http://localhost:3100/mcp -s user
cp examples/mcp-proxy.json ~/.claude/mcp-proxy.json
# Edit ~/.claude/mcp-proxy.json — add your server URLs and tokens
```

## Config (~/.claude/mcp-proxy.json)

```json
{
  "port": 3100,
  "defaultMode": "user-invocable-only",  // "on" | "user-invocable-only" | "off"
  "cache": { "ttl": 1800000, "staleMode": "serve_stale" },
  "servers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}" },
      "tools": {
        "get_file_contents": "on",
        "search_code": "on",
        "create_issue": "off"
      }
    }
  }
}
```

## Usage Flow

1. Edit `~/.claude/mcp-proxy.json` → chokidar detects change → hot-reload
2. Add new MCP via `claude mcp add X` → proxy auto-discovers → adds to config with empty `tools: {}` → `defaultMode` controls visibility
3. Proxy crashes → while-loop watchdog restarts within 2 seconds
4. Single request fails (network) → try/catch returns JSON-RPC error, process stays alive

## Key Design Decisions

- **Slim schema, not lazy loading**: CC registers tools at session start only. No mid-session refresh. Slim schema (~212B/tool vs ~2KB) reduces context footprint without requiring CC changes.
- **Cache not disk-persisted**: 300ms startup fetch cost not worth file corruption/version skew complexity.
- **No heartbeat self-kill**: Orphan proxy dead processes only use ~10MB idle RAM.
- **Server prefix removed from tool names**: CC already prefixes with `mcp__proxy__`, additional prefix caused colon issues.
- **SSE parsing**: GitHub MCP uses Streamable HTTP (SSE format). Both `tools/list` and `tools/call` responses parsed via `parseMCPResponse()`.

## Rollback

```bash
claude mcp remove proxy      # remove proxy from CC
kill $(cat ~/.claude/mcp-proxy.port)  # stop proxy
# CC reverts to direct MCP connections
```

## MCP Protocol Limitation

CC only reads MCP tools at session start. MCP spec supports `notifications/tools/list_changed` for runtime updates, but CC doesn't implement it. When Anthropic adds this, the proxy's architecture doesn't change — it already handles `initialize` + `tools/list` correctly.
