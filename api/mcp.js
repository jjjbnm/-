'use strict';
const { createUpstashRestAdapter } = require('../lib/retzef-mcp-upstash');
const { authenticateAccessToken } = require('../lib/retzef-mcp-token-store');
const { handleJsonRpc } = require('../lib/retzef-mcp-core');
const { getOAuthConfig } = require('../lib/retzef-mcp-oauth-config');

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  return null;
}
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Vary','Authorization, Origin');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'method_not_allowed'});}
  if(req.headers.origin && req.headers.origin !== 'https://chatgpt.com' && req.headers.origin !== 'https://chat.openai.com') return res.status(403).json({error:'origin_not_allowed'});
  const config=getOAuthConfig(); if(!config)return res.status(503).json({error:'oauth_not_configured'});
  const body=parseBody(req);
  if(!body || Array.isArray(body) || JSON.stringify(body).length>65536)return res.status(400).json({error:'invalid_request'});
  let redis;try{redis=createUpstashRestAdapter();}catch{return res.status(503).json({error:'storage_not_configured'});}
  const auth=await authenticateAccessToken(String(req.headers.authorization||''),{redis,audience:config.audience});
  if(!auth.ok){res.setHeader('WWW-Authenticate','Bearer error="invalid_token", resource_metadata="https://'+String(req.headers.host||'chi-liart-74.vercel.app')+'/.well-known/oauth-protected-resource"');return res.status(401).json({error:'invalid_token'});}
  async function profileFor(username){
    const raw=await redis.get('retzef:profile:'+username.toLowerCase());
    if(!raw)return null;const p=typeof raw==='string'?JSON.parse(raw):raw;
    if(!p||p.banned===true)return null;
    return {username:p.username||username,displayName:p.displayName||p.username||username,avatarUrl:p.avatarUrl||'',role:p.role||'member',tiktokConnected:typeof p.tiktokOpenId==='string'&&p.tiktokOpenId.length>0};
  }
  const adapters={
    getMyProfile:async username=>{const p=await profileFor(username);if(!p)throw new Error('unavailable');return {username:p.username,displayName:p.displayName,avatarUrl:p.avatarUrl,role:p.role};},
    getMyTikTokStatus:async username=>{const p=await profileFor(username);if(!p)throw new Error('unavailable');return {username:p.username,connected:p.tiktokConnected};}
  };
  const reply=await handleJsonRpc(body,{auth},adapters);
  if(reply===null)return res.status(202).end();
  return res.status(200).json(reply);
};
