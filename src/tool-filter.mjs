export function filterTools(cachedTools, serverConfig, defaultMode, { slimSchema } = {}) {
  const result = [];

  for (const [serverName, tools] of Object.entries(cachedTools)) {
    const serverConf = serverConfig[serverName] || { tools: {} };
    const toolSettings = serverConf.tools || {};

    for (const tool of tools) {
      const mode = toolSettings[tool.name] ?? defaultMode;
      if (mode === 'on') {
        const entry = { ...tool, name: tool.name };

        if (slimSchema && tool.inputSchema) {
          // Keep property names + types, drop descriptions/defaults/enums
          entry.inputSchema = slimSchemaVersion(tool.inputSchema);
        }

        result.push(entry);
      }
    }
  }

  return result;
}

function slimSchemaVersion(schema) {
  if (!schema.properties) return { type: 'object', additionalProperties: true };

  const slimProps = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    slimProps[key] = { type: prop.type || 'string' };
    if (prop.enum) slimProps[key].enum = prop.enum;
  }

  return {
    type: 'object',
    properties: slimProps,
    required: schema.required || [],
    additionalProperties: true,
  };
}
