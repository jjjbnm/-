'use strict';
const { getOAuthConfig } = require('../retzef-mcp-oauth-config');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const config=getOAuthConfig();
  if(!config)return res.status(503).json({error:'oauth_not_configured'});
  return res.status(200).json({resource:config.audience,authorization_servers:[config.issuer],bearer_methods_supported:['header'],scopes_supported:['profile:read','posts:read']});
};
