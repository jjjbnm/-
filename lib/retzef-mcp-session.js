'use strict';
const crypto = require('node:crypto');
const { safeEqual } = require('./retzef-mcp-security');
const COOKIE_NAME = 'retzef_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function secretValue(env = process.env) {
  const value = env.RETZEF_SESSION_SECRET;
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32 ? value : null;
}
function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value, 'utf8').digest('base64url');
}
function createSession(username, options = {}) {
  const env = options.env || process.env;
  const secret = secretValue(env);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!secret || typeof username !== 'string' || !/^[a-z0-9._-]{2,128}$/i.test(username) ||
      !Number.isSafeInteger(now) || now < 0) return null;
  const payload = Buffer.from(JSON.stringify({ sub: username.toLowerCase(), iat: now, exp: now + SESSION_TTL_SECONDS, jti: crypto.randomBytes(16).toString('base64url') })).toString('base64url');
  const body = 'v1.' + payload;
  return body + '.' + sign(body, secret);
}
function verifySession(token, options = {}) {
  const env = options.env || process.env;
  const secret = secretValue(env);
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!secret || typeof token !== 'string' || token.length > 2048 || !Number.isSafeInteger(now)) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const body = parts.slice(0, 2).join('.');
  if (!safeEqual(sign(body, secret), parts[2])) return null;
  let p;
  try { p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
  if (!p || typeof p.sub !== 'string' || !/^[a-z0-9._-]{2,128}$/.test(p.sub) ||
      !Number.isSafeInteger(p.iat) || !Number.isSafeInteger(p.exp) ||
      p.iat > now + 30 || p.exp <= now || p.exp - p.iat > SESSION_TTL_SECONDS ||
      typeof p.jti !== 'string') return null;
  return { username: p.sub, issuedAt: p.iat, expiresAt: p.exp };
}
function getCookie(req, name = COOKIE_NAME) {
  const raw = String(req?.headers?.cookie || '');
  const found = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  if (!found) return '';
  try { return decodeURIComponent(found.slice(name.length + 1)); } catch { return ''; }
}
function sessionCookie(token) {
  return COOKIE_NAME + '=' + encodeURIComponent(token) + '; Path=/; Max-Age=' + SESSION_TTL_SECONDS + '; HttpOnly; Secure; SameSite=Lax';
}
module.exports = { COOKIE_NAME, SESSION_TTL_SECONDS, createSession, verifySession, getCookie, sessionCookie };
