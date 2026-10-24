'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSession, verifySession, SESSION_TTL_SECONDS } = require('../lib/retzef-mcp-session');
const env = { RETZEF_SESSION_SECRET: 'x'.repeat(48) };
test('signed sessions bind username and expire', () => {
  const token = createSession('Test.User', { env, nowSeconds: 1000 });
  assert.ok(token);
  assert.deepEqual(verifySession(token, { env, nowSeconds: 1001 }), { username: 'test.user', issuedAt: 1000, expiresAt: 1000 + SESSION_TTL_SECONDS });
  assert.equal(verifySession(token, { env, nowSeconds: 1000 + SESSION_TTL_SECONDS }), null);
  assert.equal(verifySession(token + 'x', { env, nowSeconds: 1001 }), null);
});
test('fails closed without a long session secret', () => {
  assert.equal(createSession('testuser', { env: {} }), null);
  assert.equal(verifySession('anything', { env: {} }), null);
});
test('rejects invalid usernames and malformed token', () => {
  assert.equal(createSession('not a username', { env }), null);
  assert.equal(verifySession('v1.eyJzdWIiOiJ4In0.bad', { env }), null);
});
