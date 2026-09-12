const webpush = require('web-push');
const PREFIX = 'retzef:profile:';
function cookie(req, name) { const raw = req.headers.cookie || ''; const hit = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '=')); return hit ? decodeURIComponent(hit.slice(name.length + 1)).toLowerCase() : ''; }
function body(req) { if (!req.body) return {}; if (typeof req.body === 'object') return req.body; try { return JSON.parse(req.body); } catch (_) { return {}; } }
function cfg() { return { url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN }; }
async function redis(command, ...args) { const { url, token } = cfg(); if (!url || !token) throw new Error('storage_not_configured'); const r = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'storage_error'); return d.result; }
function configured() { return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT); }
function setup() { if (!configured()) throw new Error('push_not_configured'); webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY); }
async function profile(username) { const raw = await redis('get', `${PREFIX}${username}`); return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; }
async function sendTo(username, payload) { if (!configured()) return false; setup(); const p = await profile(username); const subs = Array.isArray(p?.pushSubscriptions) ? p.pushSubscriptions : []; const next = []; for (const sub of subs) { try { await webpush.sendNotification(sub, JSON.stringify(payload)); next.push(sub); } catch (e) { if (![404, 410].includes(e.statusCode)) next.push(sub); } } if (p) { p.pushSubscriptions = next; await redis('set', `${PREFIX}${username}`, JSON.stringify(p)); } return true; }
module.exports = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const me = cookie(req, 'retzef_profile_id');
  try {
    if (req.method === 'GET') return res.status(200).json({ configured: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : '' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!me) return res.status(401).json({ error: 'tiktok_login_required' });
    const input = body(req); const action = String(input.action || '');
    if (action === 'subscribe') { const sub = input.subscription; if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return res.status(400).json({ error: 'invalid_subscription' }); const p = await profile(me); if (!p) return res.status(401).json({ error: 'tiktok_login_required' }); p.pushSubscriptions = Array.isArray(p.pushSubscriptions) ? p.pushSubscriptions : []; p.pushSubscriptions = [...p.pushSubscriptions.filter(x => x.endpoint !== sub.endpoint), sub].slice(-5); await redis('set', `${PREFIX}${me}`, JSON.stringify(p)); return res.status(201).json({ subscribed: true, configured: configured() }); }
    if (action === 'test') { await sendTo(me, { title: 'רצף', body: 'התראות Push פעילות ✅', url: '/' }); return res.status(200).json({ sent: true }); }
    return res.status(400).json({ error: 'invalid_action' });
  } catch (e) { console.error('push API:', e.message); return res.status(503).json({ error: e.message === 'push_not_configured' ? e.message : e.message === 'storage_not_configured' ? e.message : 'push_error' }); }
};
module.exports.sendTo = sendTo;
