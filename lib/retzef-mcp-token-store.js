'use strict';

const { sha256Hex, parseBearer, normalizeScopes, hasRequiredScopes, isValidExpiry } = require('./retzef-mcp-security');

function parseRecord(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

async function authenticateAccessToken(authorizationHeader, options = {}) {
  const { redis, audience, nowSeconds = Math.floor(Date.now() / 1000) } = options;
  if (!redis || typeof redis.get !== 'function' || typeof audience !== 'string' || !audience) {
    return { ok: false, reason: 'configuration_error' };
  }
  const token = parseBearer(authorizationHeader);
  if (!token) return { ok: false, reason: 'invalid_token' };

  let rawRecord;
  try {
    rawRecord = await redis.get('retzef:mcp:access:' + sha256Hex(token));
  } catch {
    return { ok: false, reason: 'store_unavailable' };
  }
  const record = parseRecord(rawRecord);
  if (!record || typeof record.subject !== 'string' || !record.subject ||
      record.revoked === true || record.audience !== audience ||
      !isValidExpiry(record.expiresAt, nowSeconds)) {
    return { ok: false, reason: 'invalid_token' };
  }
  const scopes = normalizeScopes(record.scopes);
  if (!scopes) return { ok: false, reason: 'invalid_token' };
  return {
    ok: true,
    subject: record.subject,
    scopes,
    audience: record.audience,
    expiresAt: record.expiresAt
  };
}

module.exports = { authenticateAccessToken };
