'use strict';
const { getOAuthConfig } = require('../retzef-mcp-oauth-config');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const config=getOAuthConfig();
  if(!config)return res.status(503).json({error:'oauth_not_configured'});
  const origin=config.issuer;
  return res.status(200).json({issuer:origin,authorization_endpoint:origin+'/api/oauth/authorize',token_endpoint:origin+'/api/oauth/token',registration_endpoint:origin+'/api/oauth/register',response_types_supported:['code'],grant_types_supported:['authorization_code'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:['profile:read','posts:read'],service_documentation:origin});
};
