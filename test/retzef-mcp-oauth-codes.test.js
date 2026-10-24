'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { issueAuthorizationCode, redeemAuthorizationCode, CODE_TTL_SECONDS } = require('../lib/retzef-mcp-oauth-codes');
const { sha256Hex, pkceChallenge } = require('../lib/retzef-mcp-security');

const client = {
  clientId: 'chatgpt-client',
  redirectUris: ['https://client.example/callback']
};
const audience = 'https://retzef.example/api/mcp';
const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~';
const challenge = pkceChallenge(verifier);

function memoryRedis() {
  const map = new Map();
  return {
    map,
    async set(key, value, opts) {
      if (opts?.nx && map.has(key)) return null;
      map.set(key, value);
      return 'OK';
    },
    async consume(key) {
      const value = map.get(key);
      map.delete(key);
      return value ?? null;
    }
  };
}

function validInput(extra = {}) {
  return {
    redirectUri: client.redirectUris[0],
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    state: 'state-value-at-least-16',
    subject: 'user-123',
    audience,
    scopes: ['profile:read'],
    ...extra
  };
}

test('issues a short-lived code and stores only the digest as key', async () => {
  const redis = memoryRedis();
  const result = await issueAuthorizationCode(validInput(), {
    redis, client, nowSeconds: 1800000000, codeFactory: () => 'A'.repeat(48)
  });
  assert.equal(result.ok, true);
  assert.equal(result.expiresAt, 1800000000 + CODE_TTL_SECONDS);
  assert.equal(redis.map.has('retzef:mcp:authorization-code:' + sha256Hex('A'.repeat(48))), true);
  assert.equal([...redis.map.keys()][0].includes('A'.repeat(48)), false);
});

test('rejects unregistered redirect, weak PKCE method, bad state, and invalid scope', async () => {
  const redis = memoryRedis();
  assert.equal((await issueAuthorizationCode(validInput({ redirectUri: 'https://evil.example/cb' }), { redis, client })).ok, false);
  assert.equal((await issueAuthorizationCode(validInput({ codeChallengeMethod: 'plain' }), { redis, client })).ok, false);
  assert.equal((await issueAuthorizationCode(validInput({ state: 'short' }), { redis, client })).ok, false);
  assert.equal((await issueAuthorizationCode(validInput({ scopes: ['admin'] }), { redis, client })).ok, false);
});

test('redeems code once with exact client, redirect, audience and PKCE verifier', async () => {
  const redis = memoryRedis();
  const issued = await issueAuthorizationCode(validInput(), { redis, client, nowSeconds: 1800000000, codeFactory: () => 'B'.repeat(48) });
  assert.equal(issued.ok, true);
  const input = { code: issued.code, redirectUri: client.redirectUris[0], codeVerifier: verifier, audience };
  const result = await redeemAuthorizationCode(input, { redis, client, nowSeconds: 1800000001 });
  assert.equal(result.ok, true);
  assert.equal(result.subject, 'user-123');
  assert.deepEqual(result.scopes, ['profile:read']);
  assert.equal((await redeemAuthorizationCode(input, { redis, client, nowSeconds: 1800000002 })).ok, false);
});

test('rejects wrong verifier, client, redirect, audience, and expired code', async () => {
  for (const change of [
    { input: { codeVerifier: 'Z'.repeat(43) } },
    { input: { redirectUri: 'https://evil.example/cb' } },
    { input: { audience: 'https://other.example/mcp' } },
    { client: { clientId: 'other', redirectUris: client.redirectUris } },
    { nowSeconds: 1800000091 }
  ]) {
    const redis = memoryRedis();
    const issued = await issueAuthorizationCode(validInput(), { redis, client, nowSeconds: 1800000000, codeFactory: () => 'C'.repeat(48) });
    const input = { code: issued.code, redirectUri: client.redirectUris[0], codeVerifier: verifier, audience, ...change.input };
    const result = await redeemAuthorizationCode(input, { redis, client: change.client || client, nowSeconds: change.nowSeconds ?? 1800000001 });
    assert.equal(result.ok, false);
  }
});

test('fails closed if atomic consume is unavailable or storage fails', async () => {
  const issued = await issueAuthorizationCode(validInput(), { redis: memoryRedis(), client });
  assert.equal((await redeemAuthorizationCode({ code: issued.code, redirectUri: client.redirectUris[0], codeVerifier: verifier, audience }, { redis: { get: async () => null }, client })).ok, false);
  const redis = memoryRedis();
  redis.consume = async () => { throw new Error('private storage failure'); };
  assert.equal((await redeemAuthorizationCode({ code: 'D'.repeat(48), redirectUri: client.redirectUris[0], codeVerifier: verifier, audience }, { redis, client })).reason, 'code_store_failed');
});
