'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sec = require('../lib/retzef-mcp-security');

test('opaque tokens are high entropy and URL safe', () => {
  const token = sec.randomOpaqueToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(token, sec.randomOpaqueToken());
  assert.throws(() => sec.randomOpaqueToken(8), TypeError);
});

test('hashing is deterministic and rejects empty input', () => {
  assert.equal(sec.sha256Hex('abc'), crypto.createHash('sha256').update('abc').digest('hex'));
  assert.throws(() => sec.sha256Hex(''), TypeError);
});

test('constant-time compare handles equal and unequal strings', () => {
  assert.equal(sec.safeEqual('same', 'same'), true);
  assert.equal(sec.safeEqual('same', 'diff'), false);
  assert.equal(sec.safeEqual('x', 'longer'), false);
  assert.equal(sec.safeEqual(null, 'x'), false);
});

test('bearer parsing is strict', () => {
  assert.equal(sec.parseBearer('Bearer abc_DEF-123'), 'abc_DEF-123');
  assert.equal(sec.parseBearer('bearer token'), 'token');
  assert.equal(sec.parseBearer('Basic token'), null);
  assert.equal(sec.parseBearer('Bearer token extra'), null);
});

test('PKCE S256 accepts matching verifier only', () => {
  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012';
  const challenge = crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
  assert.equal(sec.verifyPkceS256(verifier, challenge), true);
  assert.equal(sec.verifyPkceS256(verifier, 'A'.repeat(43)), false);
  assert.equal(sec.verifyPkceS256('short', challenge), false);
});

test('scopes allow only explicit read scopes', () => {
  assert.deepEqual(sec.normalizeScopes('profile:read posts:read'), ['posts:read', 'profile:read']);
  assert.equal(sec.normalizeScopes('admin:write'), null);
  assert.equal(sec.normalizeScopes(''), null);
  assert.equal(sec.hasRequiredScopes(['profile:read'], ['profile:read']), true);
  assert.equal(sec.hasRequiredScopes(['profile:read'], ['posts:read']), false);
});

test('redirect URI validation requires HTTPS and no userinfo or fragment', () => {
  assert.equal(sec.validateRedirectUri('https://client.example/callback'), true);
  assert.equal(sec.validateRedirectUri('http://client.example/callback'), false);
  assert.equal(sec.validateRedirectUri('https://user:pass@client.example/callback'), false);
  assert.equal(sec.validateRedirectUri('https://client.example/callback#fragment'), false);
  assert.equal(sec.validateRedirectUri('not a url'), false);
});

test('expiry is bounded to access-token lifetime', () => {
  const now = 1000;
  assert.equal(sec.isValidExpiry(1100, now), true);
  assert.equal(sec.isValidExpiry(1000, now), false);
  assert.equal(sec.isValidExpiry(2000, now), false);
});
