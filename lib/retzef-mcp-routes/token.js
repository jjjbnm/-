'use strict';
const { createUpstashRestAdapter } = require('../retzef-mcp-upstash');
const { getOAuthConfig, parseFormOrJson } = require('../retzef-mcp-oauth-config');
const { getRegisteredClient } = require('../retzef-mcp-oauth-clients');
const { redeemAuthorizationCode } = require('../retzef-mcp-oauth-codes');
const { randomOpaqueToken, sha256Hex, ACCESS_TOKEN_TTL_SECONDS } = require('../retzef-mcp-security');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'method_not_allowed'});}
  const config=getOAuthConfig();if(!config)return res.status(503).json({error:'oauth_not_configured'});
  const b=parseFormOrJson(req);if(String(b.grant_type||'')!=='authorization_code')return res.status(400).json({error:'unsupported_grant_type'});
  const clientId=String(b.client_id||'');let redis;try{redis=createUpstashRestAdapter();}catch{return res.status(503).json({error:'storage_not_configured'});}
  const client=await getRegisteredClient(redis,clientId);if(!client)return res.status(401).json({error:'invalid_client'});
  const redirectUri=String(b.redirect_uri||''),code=String(b.code||''),verifier=String(b.code_verifier||''),resource=String(b.resource||config.audience);
  if(resource!==config.audience)return res.status(400).json({error:'invalid_target'});
  const result=await redeemAuthorizationCode({code,redirectUri,codeVerifier:verifier,audience:resource},{redis,client:{clientId:client.clientId,redirectUris:client.redirectUris}});
  if(!result.ok)return res.status(400).json({error:'invalid_grant'});
  const accessToken=randomOpaqueToken(32),expiresAt=Math.floor(Date.now()/1000)+ACCESS_TOKEN_TTL_SECONDS;
  const record={subject:result.subject,scopes:result.scopes,audience:result.audience,expiresAt,revoked:false,clientId:result.clientId};
  try{const saved=await redis.set('retzef:mcp:access:'+sha256Hex(accessToken),JSON.stringify(record),{ex:ACCESS_TOKEN_TTL_SECONDS,nx:true});if(saved!=='OK'&&saved!==true)return res.status(503).json({error:'token_store_failed'});}
  catch{return res.status(503).json({error:'token_store_failed'});}
  return res.status(200).json({access_token:accessToken,token_type:'Bearer',expires_in:ACCESS_TOKEN_TTL_SECONDS,scope:result.scopes.join(' '),resource:result.audience});
};
