'use strict';
const { getOAuthConfig } = require('../../lib/retzef-mcp-oauth-config');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  const config=getOAuthConfig();
  if(!config)return res.status(503).json({error:'oauth_not_configured'});
  const origin='https://'+String(req.headers.host||'chi-liart-74.vercel.app').toLowerCase();
  return res.status(200).json({resource:config.audience,authorization_servers:[origin],bearer_methods_supported:['header'],scopes_supported:['profile:read','posts:read']});
};
