'use strict';
const { createUpstashRestAdapter } = require('../retzef-mcp-upstash');
const { bodyOf, getOAuthConfig } = require('../retzef-mcp-oauth-config');
const { registerOAuthClient } = require('../retzef-mcp-oauth-clients');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store'); res.setHeader('Pragma','no-cache'); res.setHeader('Content-Type','application/json; charset=utf-8');
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({error:'method_not_allowed'}); }
  if (!getOAuthConfig()) return res.status(503).json({error:'server_error'});
  const body = bodyOf(req);
  if (!body || JSON.stringify(body).length > 32768) return res.status(400).json({error:'invalid_client_metadata'});
  let redis; try { redis = createUpstashRestAdapter(); } catch { return res.status(503).json({error:'server_error'}); }
  const result = await registerOAuthClient(body,{redis});
  if (!result.ok) return res.status(result.error === 'invalid_client_metadata' ? 400 : 503).json({error:result.error});
  return res.status(201).json(result.client);
};
