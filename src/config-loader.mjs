import { readFileSync } from 'fs';
import { resolve } from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE || '~';

const DEFAULTS = {
  port: 3100,
  fallbackPorts: [3101, 3102, 3103],
  portFile: resolve(HOME, '.claude', 'mcp-proxy.port'),
  defaultMode: 'user-invocable-only',
  cache: {
    ttl: 1800000,
    perServerMaxTools: 100,
    perToolMaxSchemaBytes: 20480,
    staleMode: 'serve_stale',
    overrides: {},
  },
  servers: {},
};

export function loadConfig(path) {
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const config = { ...DEFAULTS, ...raw };
  config.cache = { ...DEFAULTS.cache, ...(raw.cache || {}) };

  for (const [name, server] of Object.entries(config.servers)) {
    if (server.headers) {
      const resolved = {};
      for (const [key, value] of Object.entries(server.headers)) {
        resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, name) => {
          const v = process.env[name];
          if (!v) console.warn(`mcp-proxy: env var \$${name} referenced in config but not set`);
          return v || '';
        });
      }
      server.headers = resolved;
    }
  }

  return config;
}
