'use strict';
const { validateRedirectUri, normalizeScopes } = require('./retzef-mcp-security');
function getOAuthConfig(env = process.env) {
  const clientId = String(env.RETZEF_MCP_CLIENT_ID || '').trim();
  const redirectUris = String(env.RETZEF_MCP_REDIRECT_URIS || '').split(',').map(s => s.trim()).filter(Boolean);
  const audience = String(env.RETZEF_MCP_AUDIENCE || 'https://chi-liart-74.vercel.app/api/mcp').trim();
  if (!clientId || clientId.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(clientId) ||
      !redirectUris.length || redirectUris.some(uri => !validateRedirectUri(uri)) ||
      !validateRedirectUri(audience)) return null;
  return { clientId, redirectUris, audience };
}
function isOriginAllowed(req) {
  const origin = String(req?.headers?.origin || '');
  const host = String(req?.headers?.host || '').toLowerCase();
  if (!origin || !host) return false;
  try { const u = new URL(origin); return u.protocol === 'https:' && u.host.toLowerCase() === host; } catch { return false; }
}
function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch {
      const type = String(req.headers?.['content-type'] || '').toLowerCase();
      if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(req.body));
      return Object.fromEntries(new URLSearchParams(req.body));
    }
  }
  return {};
}
function queryOf(req) {
  const out = {};
  const url = new URL(req.url || '/', 'https://invalid.local');
  for (const [k,v] of url.searchParams) if (!(k in out)) out[k] = v;
  return Object.keys(req.query || {}).length ? req.query : out;
}
function parseFormOrJson(req) {
  const body = bodyOf(req);
  if (Object.keys(body).length) return body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}
module.exports = { getOAuthConfig, isOriginAllowed, bodyOf, queryOf, parseFormOrJson };
