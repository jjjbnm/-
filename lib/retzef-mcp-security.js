'use strict';

const crypto = require('node:crypto');

const ALLOWED_SCOPES = Object.freeze(['profile:read', 'posts:read']);
const AUTH_CODE_TTL_SECONDS = 120;
const ACCESS_TOKEN_TTL_SECONDS = 600;

function randomOpaqueToken(bytes = 32) {
  if (!Number.isInteger(bytes) || bytes < 32 || bytes > 128) {
    throw new TypeError('Token entropy must be between 32 and 128 bytes');
  }
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256Hex(value) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('Expected a non-empty string');
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function parseBearer(header) {
  if (typeof header !== 'string') return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

function verifyPkceS256(verifier, challenge) {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return false;
  const actual = crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
  return safeEqual(actual, challenge);
}

function normalizeScopes(input) {
  const scopes = Array.isArray(input) ? input : typeof input === 'string' ? input.trim().split(/\s+/) : [];
  if (scopes.length === 0 || scopes.some(s => typeof s !== 'string' || !ALLOWED_SCOPES.includes(s))) return null;
  return [...new Set(scopes)].sort();
}

function hasRequiredScopes(granted, required) {
  if (!Array.isArray(granted) || !Array.isArray(required)) return false;
  return required.every(scope => granted.includes(scope));
}

function validateRedirectUri(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

function isValidExpiry(exp, nowSeconds = Math.floor(Date.now() / 1000)) {
  return Number.isSafeInteger(exp) && exp > nowSeconds && exp <= nowSeconds + ACCESS_TOKEN_TTL_SECONDS + 30;
}

module.exports = {
  ALLOWED_SCOPES,
  AUTH_CODE_TTL_SECONDS,
  ACCESS_TOKEN_TTL_SECONDS,
  randomOpaqueToken,
  sha256Hex,
  safeEqual,
  parseBearer,
  verifyPkceS256,
  normalizeScopes,
  hasRequiredScopes,
  validateRedirectUri,
  isValidExpiry
};
