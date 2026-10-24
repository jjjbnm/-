'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getOAuthConfig, isOriginAllowed, parseFormOrJson, bodyOf } = require('../lib/retzef-mcp-oauth-config');
const env={RETZEF_MCP_CLIENT_ID:'chatgpt-retzef',RETZEF_MCP_REDIRECT_URIS:'https://client.example/callback,https://client.example/other',RETZEF_MCP_AUDIENCE:'https://chi-liart-74.vercel.app/api/mcp'};
test('OAuth config requires exact HTTPS redirect list and audience',()=> {
 assert.equal(getOAuthConfig(env).clientId,'chatgpt-retzef');
 assert.equal(getOAuthConfig({RETZEF_MCP_CLIENT_ID:'x',RETZEF_MCP_REDIRECT_URIS:'http://evil.test/cb'}),null);
 assert.equal(getOAuthConfig({}),null);
});
test('Origin validation only accepts same HTTPS host',()=> {
 assert.equal(isOriginAllowed({headers:{origin:'https://chi-liart-74.vercel.app',host:'chi-liart-74.vercel.app'}}),true);
 assert.equal(isOriginAllowed({headers:{origin:'https://evil.test',host:'chi-liart-74.vercel.app'}}),false);
});
test('form parsing supports urlencoded strings',()=> {
 assert.deepEqual(parseFormOrJson({body:'grant_type=authorization_code&client_id=abc'}),{grant_type:'authorization_code',client_id:'abc'});
});

test('authorization consent parses browser form submissions',()=> {
 assert.deepEqual(bodyOf({headers:{'content-type':'application/x-www-form-urlencoded'},body:'request_id=abc&csrf=xyz&decision=approve'}),{request_id:'abc',csrf:'xyz',decision:'approve'});
});
