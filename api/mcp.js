'use strict';
const { parse } = require('node:url');

const ROUTES = {
  authorize: '../lib/retzef-mcp-routes/authorize',
  token: '../lib/retzef-mcp-routes/token',
  'authorization-server': '../lib/retzef-mcp-routes/authorization-server',
  'protected-resource': '../lib/retzef-mcp-routes/protected-resource',
  mcp: '../lib/retzef-mcp-routes/mcp'
};

module.exports = async (req, res) => {
  const parsed = parse(req.url || '/', true);
  const route = String(req.query?.__retzef_route || parsed.query?.__retzef_route || 'mcp');
  const modulePath = ROUTES[route];
  if (!modulePath) return res.status(404).json({ error: 'not_found' });
  try {
    const handler = require(modulePath);
    return await handler(req, res);
  } catch (error) {
    console.error('Retzef MCP route dispatch failed:', error?.message || 'unknown');
    if (res.headersSent) return res.end();
    return res.status(500).json({ error: 'internal_error' });
  }
};
