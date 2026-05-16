export function createRouter({ filteredTools }) {
  return {
    handle(request) {
      if (request.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'mcp-proxy', version: '0.1.0' },
          },
        };
      }

      if (request.method === 'tools/list') {
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { tools: filteredTools },
        };
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32601, message: 'Method not found' },
      };
    },
  };
}
