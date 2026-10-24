'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {validateRegistration,registerOAuthClient,getRegisteredClient}=require('../lib/retzef-mcp-oauth-clients');
function memoryRedis(){const values=new Map();return {async set(k,v,o={}){if(o.nx&&values.has(k))return null;values.set(k,v);return 'OK';},async get(k){return values.get(k)||null;}};}
const valid={client_name:'Retzef Test',redirect_uris:['https://client.example/callback'],grant_types:['authorization_code'],response_types:['code'],token_endpoint_auth_method:'none'};
test('registers and retrieves a strict public OAuth client',async()=>{const redis=memoryRedis();const r=await registerOAuthClient(valid,{redis,nowSeconds:123,tokenFactory:()=> 'A'.repeat(43)});assert.equal(r.ok,true);assert.equal(r.client.client_id,'A'.repeat(43));assert.deepEqual(r.client.redirect_uris,valid.redirect_uris);assert.equal((await getRegisteredClient(redis,r.client.client_id)).clientName,'Retzef Test');});
test('rejects HTTP and duplicate redirect URIs',()=>{assert.equal(validateRegistration({...valid,redirect_uris:['http://client.example/callback']}).ok,false);assert.equal(validateRegistration({...valid,redirect_uris:[...valid.redirect_uris,...valid.redirect_uris]}).ok,false);});
test('rejects confidential clients and unsupported grants',()=>{assert.equal(validateRegistration({...valid,token_endpoint_auth_method:'client_secret_post'}).ok,false);assert.equal(validateRegistration({...valid,grant_types:['password']}).ok,false);});
test('unknown client IDs do not resolve',async()=>{assert.equal(await getRegisteredClient(memoryRedis(),'B'.repeat(43)),null);});
