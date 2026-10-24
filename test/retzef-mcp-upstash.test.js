'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createUpstashRestAdapter } = require('../lib/retzef-mcp-upstash');

function fakeFetch(results) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const next = results.shift();
    if (next instanceof Error) throw next;
    return { ok: next.ok !== false, status: next.status || 200, json: async () => next.body };
  };
  return { calls, fetchImpl };
}

test('adapter uses HTTPS and JSON Redis commands', async () => {
  const fake = fakeFetch([{ body: { result: 'value' } }, { body: { result: 'OK' } }]);
  const redis = createUpstashRestAdapter({ url: 'https://example.upstash.io/', token: 'secret', fetchImpl: fake.fetchImpl });
  assert.equal(await redis.get('key'), 'value');
  assert.equal(await redis.set('key', 'json', { ex: 90, nx: true }), 'OK');
  assert.deepEqual(JSON.parse(fake.calls[0].init.body), ['GET', 'key']);
  assert.deepEqual(JSON.parse(fake.calls[1].init.body), ['SET', 'key', 'json', 'EX', '90', 'NX']);
  assert.equal(fake.calls[0].init.headers.Authorization, 'Bearer secret');
  assert.equal(fake.calls[0].url, 'https://example.upstash.io');
});

test('consume is one atomic Lua EVAL, not GET followed by DEL', async () => {
  const fake = fakeFetch([{ body: { result: '{"subject":"u"}' } }]);
  const redis = createUpstashRestAdapter({ url: 'https://example.upstash.io', token: 'secret', fetchImpl: fake.fetchImpl });
  assert.equal(await redis.consume('one-time-code'), '{"subject":"u"}');
  const command = JSON.parse(fake.calls[0].init.body);
  assert.equal(command[0], 'EVAL');
  assert.equal(command[2], '1');
  assert.equal(command[3], 'one-time-code');
  assert.match(command[1], /redis.call\('GET'/);
  assert.match(command[1], /redis.call\('DEL'/);
  assert.equal(fake.calls.length, 1);
});

test('rejects insecure configuration and invalid TTL', async () => {
  assert.throws(() => createUpstashRestAdapter({ url: 'http://example.upstash.io', token: 'secret', fetchImpl: async () => ({}) }), /configuration/);
  const redis = createUpstashRestAdapter({ url: 'https://example.upstash.io', token: 'secret', fetchImpl: async () => ({ ok: true, json: async () => ({ result: 'OK' }) }) });
  await assert.rejects(() => redis.set('key', 'value', { ex: 0 }), /ttl/);
});

test('fails closed on HTTP or Redis errors without exposing response details', async () => {
  const fake = fakeFetch([{ ok: false, status: 401, body: { error: 'sensitive server detail' } }]);
  const redis = createUpstashRestAdapter({ url: 'https://example.upstash.io', token: 'secret', fetchImpl: fake.fetchImpl });
  await assert.rejects(() => redis.get('key'), (error) => {
    assert.equal(error.message, 'upstash_command_failed');
    assert.doesNotMatch(error.message, /sensitive/);
    return true;
  });
});
