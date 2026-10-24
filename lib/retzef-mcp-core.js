'use strict';

const SERVER_INFO = Object.freeze({ name: 'retzef-mcp', version: '0.1.0' });
const PROTOCOL_VERSION = '2025-03-26';
const TOOLS = Object.freeze([
  { name: 'retzef_get_my_profile', description: 'Read the authenticated Retzef profile.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, requiredScope: 'profile:read' },
  { name: 'retzef_get_my_tiktok_status', description: 'Read TikTok connection status for the authenticated Retzef profile.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, requiredScope: 'posts:read' }
]);

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code, message } };
}
function result(id, value) { return { jsonrpc: '2.0', id, result: value }; }
function textResult(value) { return { content: [{ type: 'text', text: JSON.stringify(value) }] }; }

async function handleJsonRpc(message, context = {}, adapters = {}) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message && message.id, -32600, 'Invalid Request');
  }
  const notification = !Object.prototype.hasOwnProperty.call(message, 'id');
  const id = message.id;
  if (notification && (message.method === 'notifications/initialized' || message.method.startsWith('notifications/'))) return null;
  if (message.method === 'initialize') {
    const requested = message.params && message.params.protocolVersion;
    return result(id, { protocolVersion: requested === PROTOCOL_VERSION ? requested : PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO });
  }
  if (message.method === 'ping') return result(id, {});
  if (message.method === 'tools/list') {
    if (!context.auth || context.auth.ok !== true) return rpcError(id, -32001, 'Authentication required');
    return result(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (message.method === 'tools/call') {
    if (!context.auth || context.auth.ok !== true || typeof context.auth.subject !== 'string' || !context.auth.subject) return rpcError(id, -32001, 'Authentication required');
    const params = message.params;
    if (!params || typeof params.name !== 'string') return rpcError(id, -32602, 'Invalid params');
    const tool = TOOLS.find(t => t.name === params.name);
    if (!tool) return rpcError(id, -32602, 'Unknown tool');
    if (!context.auth.scopes || !context.auth.scopes.includes(tool.requiredScope)) return rpcError(id, -32003, 'Insufficient scope');
    if (params.arguments && (typeof params.arguments !== 'object' || Array.isArray(params.arguments) || Object.keys(params.arguments).length !== 0)) return rpcError(id, -32602, 'This tool accepts no arguments');
    const adapter = tool.name === 'retzef_get_my_profile' ? adapters.getMyProfile : adapters.getMyTikTokStatus;
    if (typeof adapter !== 'function') return rpcError(id, -32603, 'Tool temporarily unavailable');
    try {
      // The user identity always comes from verified server-side auth, never from tool arguments.
      const data = await adapter(context.auth.subject);
      return result(id, textResult(data));
    } catch {
      return rpcError(id, -32603, 'Tool temporarily unavailable');
    }
  }
  if (message.method.startsWith('notifications/')) return null;
  return rpcError(id, -32601, 'Method not found');
}

module.exports = { SERVER_INFO, PROTOCOL_VERSION, TOOLS, handleJsonRpc };
