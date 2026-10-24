'use strict';
const { randomOpaqueToken, sha256Hex, verifyPkceS256, normalizeScopes, validateRedirectUri } = require('./retzef-mcp-security');
const CODE_TTL_SECONDS = 90;
function fail(reason) { return { ok: false, reason }; }
function validClient(client) {
  return !!client && typeof client.clientId === 'string' && client.clientId.length > 0 &&
    Array.isArray(client.redirectUris) && client.redirectUris.length > 0 &&
    client.redirectUris.every(uri => typeof uri === 'string' && validateRedirectUri(uri));
}
function exactRedirectAllowed(client, redirectUri) {
  return validClient(client) && typeof redirectUri === 'string' && client.redirectUris.includes(redirectUri) && validateRedirectUri(redirectUri);
}
function validPkceChallenge(challenge, method) {
  return method === 'S256' && typeof challenge === 'string' && /^[A-Za-z0-9_-]{43}$/.test(challenge);
}
// Redis adapter contract: set(key, value, { ex: ttl, nx: true }); redemption needs atomic consume(key).
async function issueAuthorizationCode(input, options = {}) {
  const { redis, client, nowSeconds = Math.floor(Date.now() / 1000), codeFactory = () => randomOpaqueToken(32) } = options;
  if (!redis || typeof redis.set !== 'function' || !validClient(client)) return fail('configuration_error');
  if (!input || typeof input !== 'object') return fail('invalid_request');
  const { redirectUri, codeChallenge, codeChallengeMethod, state, subject, audience } = input;
  if (!exactRedirectAllowed(client, redirectUri)) return fail('invalid_redirect_uri');
  if (!validPkceChallenge(codeChallenge, codeChallengeMethod)) return fail('invalid_pkce');
  if (typeof state !== 'string' || state.length < 16 || state.length > 512) return fail('invalid_state');
  if (typeof subject !== 'string' || !subject || subject.length > 256) return fail('invalid_subject');
  if (typeof audience !== 'string' || !validateRedirectUri(audience)) return fail('invalid_audience');
  const scopes = normalizeScopes(input.scopes);
  if (!scopes || !Number.isSafeInteger(nowSeconds) || nowSeconds < 0) return fail('invalid_scope');
  const code = codeFactory();
  if (typeof code !== 'string' || code.length < 32 || code.length > 512) return fail('code_generation_failed');
  const key = 'retzef:mcp:authorization-code:' + sha256Hex(code);
  const record = { clientId: client.clientId, redirectUri, codeChallenge, codeChallengeMethod: 'S256', state, subject, audience, scopes, expiresAt: nowSeconds + CODE_TTL_SECONDS, used: false };
  try {
    const stored = await redis.set(key, JSON.stringify(record), { ex: CODE_TTL_SECONDS, nx: true });
    if (stored !== 'OK' && stored !== true) return fail('code_store_failed');
  } catch { return fail('code_store_failed'); }
  return { ok: true, code, state, expiresAt: record.expiresAt };
}
async function redeemAuthorizationCode(input, options = {}) {
  const { redis, client, nowSeconds = Math.floor(Date.now() / 1000) } = options;
  if (!redis || typeof redis.consume !== 'function' || !validClient(client)) return fail('configuration_error');
  if (!input || typeof input !== 'object') return fail('invalid_request');
  const { code, redirectUri, codeVerifier, audience } = input;
  if (typeof code !== 'string' || code.length < 32 || code.length > 512) return fail('invalid_code');
  if (!exactRedirectAllowed(client, redirectUri)) return fail('invalid_redirect_uri');
  if (typeof codeVerifier !== 'string' || codeVerifier.length < 43 || codeVerifier.length > 128 || !/^[A-Za-z0-9._~-]+$/.test(codeVerifier)) return fail('invalid_pkce');
  if (typeof audience !== 'string' || !validateRedirectUri(audience) || !Number.isSafeInteger(nowSeconds)) return fail('invalid_request');
  let raw;
  try { raw = await redis.consume('retzef:mcp:authorization-code:' + sha256Hex(code)); } catch { return fail('code_store_failed'); }
  if (!raw) return fail('invalid_code');
  let record = raw;
  if (typeof raw === 'string') { try { record = JSON.parse(raw); } catch { return fail('invalid_code'); } }
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.clientId !== client.clientId ||
      record.redirectUri !== redirectUri || record.audience !== audience || record.used !== false ||
      !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= nowSeconds ||
      !verifyPkceS256(codeVerifier, record.codeChallenge) || record.codeChallengeMethod !== 'S256') return fail('invalid_code');
  const scopes = normalizeScopes(record.scopes);
  if (!scopes || typeof record.subject !== 'string' || !record.subject) return fail('invalid_code');
  return { ok: true, subject: record.subject, audience: record.audience, scopes, clientId: record.clientId };
}
module.exports = { CODE_TTL_SECONDS, issueAuthorizationCode, redeemAuthorizationCode };
