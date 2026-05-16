export function parseMCPResponse(text) {
  // Handle SSE (Streamable HTTP): extract JSON from "data:" lines
  if (text.startsWith('event:') || text.startsWith('data:')) {
    const dataLine = text.split('\n').find(l => l.startsWith('data:'));
    if (dataLine) return JSON.parse(dataLine.replace(/^data:\s*/, ''));
  }
  // Fallback: plain JSON
  return JSON.parse(text);
}

export class ToolCache {
  constructor(options = {}) {
    this._ttl = options.ttl || 1800000;
    this._staleMode = options.staleMode || 'serve_stale';
    this._data = null;
    this._lastFetch = 0;
  }

  async fetchAll(servers, { fetch: customFetch }) {
    const now = Date.now();
    if (this._data && (now - this._lastFetch) < this._ttl) {
      return this._data;
    }

    try {
      const entries = await Promise.all(
        Object.entries(servers).map(async ([name, conf]) => {
          const res = await customFetch(`${conf.url}/tools/list`, {
            method: 'POST',
            headers: { ...(conf.headers || {}), 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
          });
          const text = await res.text();
          const json = parseMCPResponse(text);
          const tools = json.result?.tools || [];
          return [name, tools];
        })
      );
      this._data = Object.fromEntries(entries);
      this._lastFetch = now;
    } catch (err) {
      if (this._staleMode !== 'serve_stale' || !this._data) {
        throw err;
      }
      console.warn('mcp-proxy: fetch failed, serving stale cache');
    }
    return this._data;
  }

  getAll() {
    return this._data || {};
  }
}
