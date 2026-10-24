'use strict';

const CONSUME_SCRIPT = [
  "local value = redis.call('GET', KEYS[1])",
  "if value then redis.call('DEL', KEYS[1]) end",
  "return value"
].join('\n');

function createUpstashRestAdapter(options = {}) {
  const env = options.env || process.env;
  const rawUrl = options.url || env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = options.token || env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof rawUrl !== 'string' || typeof token !== 'string' || !token ||
      typeof fetchImpl !== 'function') {
    throw new Error('upstash_configuration_error');
  }
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error('upstash_configuration_error'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.search || parsed.hash) throw new Error('upstash_configuration_error');
  const baseUrl = rawUrl.replace(/\/+$/, '');

  async function command(args) {
    const response = await fetchImpl(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5000)
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('upstash_response_error'); }
    if (!response.ok || !data || data.error) throw new Error('upstash_command_failed');
    return data.result;
  }

  return Object.freeze({
    async get(key) {
      if (typeof key !== 'string' || !key) throw new Error('invalid_key');
      return command(['GET', key]);
    },
    async set(key, value, opts = {}) {
      if (typeof key !== 'string' || !key || typeof value !== 'string') throw new Error('invalid_set');
      const args = ['SET', key, value];
      if (opts.ex !== undefined) {
        if (!Number.isSafeInteger(opts.ex) || opts.ex < 1 || opts.ex > 86400) throw new Error('invalid_ttl');
        args.push('EX', String(opts.ex));
      }
      if (opts.nx === true) args.push('NX');
      else if (opts.nx !== undefined && opts.nx !== false) throw new Error('invalid_set_options');
      return command(args);
    },
    async consume(key) {
      if (typeof key !== 'string' || !key) throw new Error('invalid_key');
      return command(['EVAL', CONSUME_SCRIPT, '1', key]);
    }
  });
}

module.exports = { createUpstashRestAdapter };
