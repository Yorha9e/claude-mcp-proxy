import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createServer } from 'http';
import { watch } from 'chokidar';
import { loadConfig } from '../src/config-loader.mjs';
import { ToolCache, parseMCPResponse } from '../src/cache.mjs';
import { filterTools } from '../src/tool-filter.mjs';
import { createRouter } from '../src/router.mjs';

const HOME = process.env.HOME || process.env.USERPROFILE || '~';
const CONFIG_PATH = resolve(HOME, '.claude', 'mcp-proxy.json');
const PORTFILE = resolve(HOME, '.claude', 'mcp-proxy.port');

function getAvailablePort(preferred, fallbacks) {
  const ports = [preferred, ...fallbacks];
  return ports[0];
}

async function main() {
  let config = loadConfig(CONFIG_PATH);
  const port = getAvailablePort(config.port, config.fallbackPorts);

  writeFileSync(PORTFILE, String(port), 'utf-8');

  let cache = new ToolCache(config.cache);

  // Hot-reload config on file change
  watch(CONFIG_PATH, { ignoreInitial: true }).on('change', () => {
    config = loadConfig(CONFIG_PATH);
    cache = new ToolCache(config.cache);
  });

  // Auto-discover new MCP servers from Claude Code on each request
  const CC_JSON = resolve(HOME, '.claude.json');
  let lastCCSync = 0;
  function syncCCServers() {
    const now = Date.now();
    if (now - lastCCSync < 5000) return; // throttle: max once per 5s
    lastCCSync = now;
    try {
      const ccConfig = JSON.parse(readFileSync(CC_JSON, 'utf-8'));
      const ccServers = ccConfig.mcpServers || {};
      let changed = false;

      for (const [name, conf] of Object.entries(ccServers)) {
        if (name === 'proxy') continue; // skip self
        if (!config.servers[name]) {
          config.servers[name] = {
            type: conf.type || 'http',
            url: conf.url || conf.command || '',
            headers: conf.headers || {},
            tools: {},
          };
          changed = true;
        }
      }

      if (changed) {
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
        config = loadConfig(CONFIG_PATH);
        cache = new ToolCache(config.cache);
      }
    } catch {}
  }

  const server = createServer(async (req, res) => {
    try {
      // Health check for Claude Code
      if (req.method === 'GET' && req.url === '/mcp') {
        res.writeHead(200).end();
        return;
      }

      if (req.method !== 'POST' || req.url !== '/mcp') {
        res.writeHead(404).end();
        return;
      }

      syncCCServers();
      const body = JSON.parse(await readBody(req));
      const allTools = await cache.fetchAll(config.servers, { fetch });
      const filtered = filterTools(allTools, config.servers, config.defaultMode, { slimSchema: true });

      // Handle tools/call: forward to backend
      if (body.method === 'tools/call') {
        const toolName = body.params?.name;

        // Find which server has this tool
        let targetServer = null;
        for (const [sname, stools] of Object.entries(allTools)) {
          if (stools.some(t => t.name === toolName)) {
            targetServer = config.servers[sname];
            break;
          }
        }

        if (!targetServer) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0', id: body.id,
            error: { code: -32602, message: `Tool not found: ${toolName}` },
          }));
          return;
        }

        // Forward the call to the backend server
        const backendResp = await fetch(targetServer.url, {
          method: 'POST',
          headers: { ...(targetServer.headers || {}), 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const text = await backendResp.text();
        const parsed = parseMCPResponse(text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(parsed));
        return;
      }

      // All other methods routed through local router
      const router = createRouter({ filteredTools: filtered });
      const response = router.handle(body);

      if (response === null) {
        res.writeHead(202).end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (err) {
      console.error('mcp-proxy: request error:', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: -1,
        error: { code: -32603, message: `Internal error: ${err.message}` },
      }));
    }
  });

  server.listen(port, () => {
    process.stdout.write(`mcp-proxy listening on ${port}\n`);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
