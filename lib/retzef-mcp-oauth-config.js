'use strict';
const { validateRedirectUri } = require('./retzef-mcp-security');
function getOAuthConfig(env = process.env) {
  const audience = String(env.RETZEF_MCP_AUDIENCE || 'https://chi-liart-74.vercel.app/api/mcp').trim();
  const issuer = String(env.RETZEF_MCP_ISSUER || 'https://chi-liart-74.vercel.app').trim().replace(/\/+$/, '');
  if (!validateRedirectUri(audience) || !validateRedirectUri(issuer)) return null;
  return { audience, issuer };
}
function bodyOf(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return Object.fromEntries(new URLSearchParams(req.body)); } }
  return {};
}
function queryOf(req) {
  const out = {}; const url = new URL(req.url || '/', 'https://invalid.local');
  for (const [k,v] of url.searchParams) if (!(k in out)) out[k] = v;
  return Object.keys(req.query || {}).length ? req.query : out;
}
function parseFormOrJson(req) { return bodyOf(req); }
module.exports = { getOAuthConfig, bodyOf, queryOf, parseFormOrJson };
