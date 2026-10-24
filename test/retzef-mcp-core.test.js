'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleJsonRpc, TOOLS } = require('../lib/retzef-mcp-core');

const auth = { ok: true, subject: 'user-123', scopes: ['profile:read', 'posts:read'] };

test('initialize and ping respond', async () => {
  const init = await handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(init.result.serverInfo.name, 'retzef-mcp');
  assert.deepEqual((await handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'ping' })).result, {});
});

test('reject malformed JSON-RPC and unknown methods', async () => {
  assert.equal((await handleJsonRpc({ method: 'ping', id: 1 })).error.code, -32600);
  assert.equal((await handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'missing' })).error.code, -32601);
});

test('tools list requires verified authentication', async () => {
  assert.equal((await handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).error.code, -32001);
  assert.equal((await handleJsonRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { auth })).result.tools.length, TOOLS.length);
});

test('tool call requires scope and derives subject only from auth context', async () => {
  let seenSubject;
  const adapters = { getMyProfile: async subject => { seenSubject = subject; return { username: subject }; } };
  const msg = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'retzef_get_my_profile', arguments: {} } };
  const out = await handleJsonRpc(msg, { auth }, adapters);
  assert.equal(seenSubject, 'user-123');
  assert.equal(JSON.parse(out.result.content[0].text).username, 'user-123');
  const denied = await handleJsonRpc(msg, { auth: { ...auth, scopes: [] } }, adapters);
  assert.equal(denied.error.code, -32003);
  const injected = await handleJsonRpc({ ...msg, params: { ...msg.params, arguments: { username: 'someone-else' } } }, { auth }, adapters);
  assert.equal(injected.error.code, -32602);
});

test('tool adapter failures are not leaked', async () => {
  const msg = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'retzef_get_my_profile', arguments: {} } };
  const out = await handleJsonRpc(msg, { auth }, { getMyProfile: async () => { throw new Error('secret internal detail'); } });
  assert.equal(out.error.code, -32603);
  assert.equal(out.error.message.includes('secret'), false);
});

test('notifications do not produce responses', async () => {
  assert.equal(await handleJsonRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});
