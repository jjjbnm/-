'use strict';
const crypto = require('node:crypto');
const { createUpstashRestAdapter } = require('../../lib/retzef-mcp-upstash');
const { getOAuthConfig, isOriginAllowed, bodyOf, queryOf } = require('../../lib/retzef-mcp-oauth-config');
const { verifySession, getCookie } = require('../../lib/retzef-mcp-session');
const { normalizeScopes, randomOpaqueToken, sha256Hex } = require('../../lib/retzef-mcp-security');
const { issueAuthorizationCode } = require('../../lib/retzef-mcp-oauth-codes');

function html(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function respond(res, status, text) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).send('<!doctype html><html lang="he"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retzef authorization</title><body style="font:16px system-ui;max-width:620px;margin:40px auto;padding:20px"><h1>Retzef MCP</h1>'+text+'</body></html>');
}
async function getProfile(redis, username) {
  const raw = await redis.get('retzef:profile:' + username);
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'method_not_allowed'}); }
  const config = getOAuthConfig();
  if (!config) return res.status(503).json({error:'oauth_not_configured'});
  const session = verifySession(getCookie(req));
  if (!session) return respond(res, 401, '<p>צריך להתחבר מחדש לאתר Retzef דרך TikTok כדי להמשיך.</p><p>לא ניתן לאשר גישה דרך עוגיית שם המשתמש הישנה.</p>');
  let redis;
  try { redis = createUpstashRestAdapter(); } catch { return res.status(503).json({error:'storage_not_configured'}); }
  let profile;
  try { profile = await getProfile(redis, session.username); } catch { return res.status(503).json({error:'storage_unavailable'}); }
  if (!profile || profile.banned === true) return respond(res, 403, '<p>אין אפשרות לאשר גישה לחשבון הזה.</p>');
  if (req.method === 'GET') {
    const q = queryOf(req);
    const clientId = String(q.client_id || '');
    const redirectUri = String(q.redirect_uri || '');
    const responseType = String(q.response_type || '');
    const state = String(q.state || '');
    const challenge = String(q.code_challenge || '');
    const method = String(q.code_challenge_method || '');
    const scopes = normalizeScopes(String(q.scope || '').split(/\s+/).filter(Boolean));
    const audience = String(q.resource || config.audience);
    if (clientId !== config.clientId || !config.redirectUris.includes(redirectUri) || responseType !== 'code' ||
        state.length < 16 || state.length > 512 || !/^[A-Za-z0-9_-]{43}$/.test(challenge) || method !== 'S256' ||
        !scopes || audience !== config.audience) return respond(res, 400, '<p>בקשת ההרשאה לא תקינה או שהאפליקציה אינה רשומה.</p>');
    const requestId = randomOpaqueToken(32);
    const csrf = randomOpaqueToken(32);
    const pending = { requestId, csrfHash: sha256Hex(csrf), username: session.username, clientId, redirectUri, state, codeChallenge: challenge, codeChallengeMethod: method, scopes, audience, expiresAt: Math.floor(Date.now()/1000)+300 };
    try {
      const stored = await redis.set('retzef:mcp:pending:' + sha256Hex(requestId), JSON.stringify(pending), {ex:300,nx:true});
      if (stored !== 'OK') return respond(res, 503, '<p>לא ניתן לשמור את בקשת ההרשאה כרגע.</p>');
    } catch { return respond(res, 503, '<p>שירות ההרשאות אינו זמין כרגע.</p>'); }
    const scopeLabels = scopes.map(s => '<li>'+html(s === 'profile:read' ? 'קריאת הפרופיל שלך' : 'קריאת סטטוס חיבור TikTok')+'</li>').join('');
    return respond(res, 200, '<p>האפליקציה מבקשת גישה לחשבון Retzef שלך:</p><ul>'+scopeLabels+'</ul><p><b>חשבון:</b> '+html(session.username)+'</p><form method="post"><input type="hidden" name="request_id" value="'+html(requestId)+'"><input type="hidden" name="csrf" value="'+html(csrf)+'"><button name="decision" value="approve">אישור</button> <button name="decision" value="deny">דחייה</button></form><p>האישור מוגבל להרשאות שמופיעות כאן.</p>');
  }
  const b = bodyOf(req);
  const requestId = String(b.request_id || '');
  const csrf = String(b.csrf || '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(requestId) || !csrf || csrf.length > 256) return respond(res, 400, '<p>בקשה לא תקינה.</p>');
  let raw;
  try { raw = await redis.consume('retzef:mcp:pending:' + sha256Hex(requestId)); } catch { return respond(res, 503, '<p>שירות ההרשאות אינו זמין כרגע.</p>'); }
  let pending;
  try { pending = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { pending = null; }
  if (!pending || pending.username !== session.username || pending.expiresAt <= Math.floor(Date.now()/1000) ||
      pending.csrfHash !== sha256Hex(csrf)) return respond(res, 400, '<p>הבקשה פגה או שאינה תקינה. נסה להתחיל מחדש.</p>');
  const redirect = new URL(pending.redirectUri);
  if (b.decision !== 'approve') { redirect.searchParams.set('error','access_denied'); redirect.searchParams.set('state',pending.state); return res.redirect(302, redirect.toString()); }
  let code;
  try {
    code = await issueAuthorizationCode({redirectUri:pending.redirectUri,codeChallenge:pending.codeChallenge,codeChallengeMethod:pending.codeChallengeMethod,state:pending.state,subject:session.username,audience:pending.audience,scopes:pending.scopes},{redis,client:{clientId:config.clientId,redirectUris:config.redirectUris}});
  } catch { code = {ok:false}; }
  if (!code?.ok) return respond(res, 503, '<p>לא ניתן ליצור קוד הרשאה כרגע.</p>');
  redirect.searchParams.set('code',code.code);
  redirect.searchParams.set('state',pending.state);
  return res.redirect(302, redirect.toString());
};
