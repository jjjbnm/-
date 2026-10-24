'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {getOAuthConfig}=require('../lib/retzef-mcp-oauth-config');
test('uses canonical production audience and issuer by default',()=>assert.deepEqual(getOAuthConfig({}),{audience:'https://chi-liart-74.vercel.app/api/mcp',issuer:'https://chi-liart-74.vercel.app'}));
test('rejects non-HTTPS issuer or audience',()=>{assert.equal(getOAuthConfig({RETZEF_MCP_ISSUER:'http://example.com'}),null);assert.equal(getOAuthConfig({RETZEF_MCP_AUDIENCE:'http://example.com/mcp'}),null);});
test('accepts explicit HTTPS values and normalizes issuer slash',()=>assert.deepEqual(getOAuthConfig({RETZEF_MCP_ISSUER:'https://retzef.example/',RETZEF_MCP_AUDIENCE:'https://retzef.example/api/mcp'}),{audience:'https://retzef.example/api/mcp',issuer:'https://retzef.example'}));
