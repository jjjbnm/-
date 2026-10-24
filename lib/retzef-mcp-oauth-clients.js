'use strict';
const { randomOpaqueToken, sha256Hex, validateRedirectUri } = require('./retzef-mcp-security');
const CLIENT_TTL_SECONDS = 365 * 24 * 60 * 60;
function validateRegistration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok:false };
  const redirectUris = input.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length < 1 || redirectUris.length > 8) return { ok:false };
  if (redirectUris.some(uri => typeof uri !== 'string' || !validateRedirectUri(uri)) || new Set(redirectUris).size !== redirectUris.length) return { ok:false };
  if (input.grant_types !== undefined && (!Array.isArray(input.grant_types) || input.grant_types.length !== 1 || input.grant_types[0] !== 'authorization_code')) return { ok:false };
  if (input.response_types !== undefined && (!Array.isArray(input.response_types) || input.response_types.length !== 1 || input.response_types[0] !== 'code')) return { ok:false };
  if (input.token_endpoint_auth_method !== undefined && input.token_endpoint_auth_method !== 'none') return { ok:false };
  return { ok:true, redirectUris:[...redirectUris], clientName:typeof input.client_name === 'string' ? input.client_name.trim().slice(0,128) : '' };
}
async function registerOAuthClient(input, { redis, nowSeconds = Math.floor(Date.now()/1000), tokenFactory = () => randomOpaqueToken(32) } = {}) {
  if (!redis || typeof redis.set !== 'function') return {ok:false,error:'server_error'};
  const valid = validateRegistration(input);
  if (!valid.ok) return {ok:false,error:'invalid_client_metadata'};
  const clientId = tokenFactory();
  if (typeof clientId !== 'string' || clientId.length < 32 || clientId.length > 256) return {ok:false,error:'server_error'};
  const record = {clientId,clientName:valid.clientName || 'MCP client',redirectUris:valid.redirectUris,grantTypes:['authorization_code'],responseTypes:['code'],tokenEndpointAuthMethod:'none',createdAt:nowSeconds};
  try {
    const saved = await redis.set('retzef:mcp:client:' + sha256Hex(clientId), JSON.stringify(record), {ex:CLIENT_TTL_SECONDS,nx:true});
    if (saved !== 'OK' && saved !== true) return {ok:false,error:'server_error'};
  } catch { return {ok:false,error:'server_error'}; }
  return {ok:true,client:toPublicClient(record)};
}
async function getRegisteredClient(redis, clientId) {
  if (!redis || typeof redis.get !== 'function' || typeof clientId !== 'string' || clientId.length < 32 || clientId.length > 256) return null;
  try {
    const raw = await redis.get('retzef:mcp:client:' + sha256Hex(clientId));
    if (!raw) return null;
    const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!record || record.clientId !== clientId || !Array.isArray(record.redirectUris) || !record.redirectUris.length || record.redirectUris.some(uri => !validateRedirectUri(uri))) return null;
    return record;
  } catch { return null; }
}
function toPublicClient(record) {
  return {client_id:record.clientId,client_id_issued_at:record.createdAt,client_name:record.clientName,redirect_uris:record.redirectUris,grant_types:record.grantTypes,response_types:record.responseTypes,token_endpoint_auth_method:record.tokenEndpointAuthMethod};
}
module.exports = {CLIENT_TTL_SECONDS,validateRegistration,registerOAuthClient,getRegisteredClient,toPublicClient};
