'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticateAccessToken } = require('../lib/retzef-mcp-token-store');
const { sha256Hex } = require('../lib/retzef-mcp-security');

function setup(record, opts = {}) {
  const requestedKeys = [];
  const redis = {
    async get(key) {
      requestedKeys.push(key);
      if (opts.fail) throw new Error('private redis failure');
      return record === undefined ? null : JSON.stringify(record);
    }
  };
  return { redis, requestedKeys };
}
const validRecord = {
  subject: 'user-123',
  scopes: ['profile:read'],
  audience: 'https://retzef.example/api/mcp',
  expiresAt: 1800000300,
  revoked: false
};

test('authenticates a valid opaque token by its digest, not raw token', async () => {
  const { redis, requestedKeys } = setup(validRecord);
  const result = await authenticateAccessToken('Bearer secret-token-value', {
    redis, audience: validRecord.audience, nowSeconds: 1800000000
  });
  assert.equal(result.ok, true);
  assert.equal(result.subject, 'user-123');
  assert.deepEqual(result.scopes, ['profile:read']);
  assert.equal(requestedKeys[0], 'retzef:mcp:access:' + sha256Hex('secret-token-value'));
  assert.equal(requestedKeys[0].includes('secret-token-value'), false);
});

test('rejects missing and malformed bearer tokens', async () => {
  const { redis, requestedKeys } = setup(validRecord);
  assert.deepEqual(await authenticateAccessToken('', { redis, audience: validRecord.audience }), { ok: false, reason: 'invalid_token' });
  assert.deepEqual(await authenticateAccessToken('Basic abc', { redis, audience: validRecord.audience }), { ok: false, reason: 'invalid_token' });
  assert.equal(requestedKeys.length, 0);
});

test('rejects unknown token', async () => {
  const { redis } = setup(undefined);
  assert.equal((await authenticateAccessToken('Bearer unknown', { redis, audience: validRecord.audience })).ok, false);
});

test('rejects expired token', async () => {
  const { redis } = setup({ ...validRecord, expiresAt: 1799999999 });
  assert.equal((await authenticateAccessToken('Bearer x', { redis, audience: validRecord.audience, nowSeconds: 1800000000 })).ok, false);
});

test('rejects revoked token and wrong audience', async () => {
  const revoked = setup({ ...validRecord, revoked: true });
  assert.equal((await authenticateAccessToken('Bearer x', { redis: revoked.redis, audience: validRecord.audience, nowSeconds: 1800000000 })).ok, false);
  const wrongAudience = setup({ ...validRecord, audience: 'https://other.example/mcp' });
  assert.equal((await authenticateAccessToken('Bearer x', { redis: wrongAudience.redis, audience: validRecord.audience, nowSeconds: 1800000000 })).ok, false);
});

test('rejects unsupported scopes and Redis failures without leaking details', async () => {
  const invalidScopes = setup({ ...validRecord, scopes: ['admin'] });
  assert.equal((await authenticateAccessToken('Bearer x', { redis: invalidScopes.redis, audience: validRecord.audience, nowSeconds: 1800000000 })).ok, false);
  const broken = setup(validRecord, { fail: true });
  assert.deepEqual(await authenticateAccessToken('Bearer x', { redis: broken.redis, audience: validRecord.audience }), { ok: false, reason: 'store_unavailable' });
});

test('fails closed when server configuration is missing', async () => {
  assert.deepEqual(await authenticateAccessToken('Bearer x', { audience: validRecord.audience }), { ok: false, reason: 'configuration_error' });
});
