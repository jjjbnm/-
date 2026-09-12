function cookie(req, name) { const raw = req.headers.cookie || ''; const hit = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '=')); return hit ? decodeURIComponent(hit.slice(name.length + 1)).toLowerCase() : ''; }
const { sendTo } = require('../lib/push');
function body(req) { if (!req.body) return {}; if (typeof req.body === 'object') return req.body; try { return JSON.parse(req.body); } catch (_) { return {}; } }
const cfg = () => ({ url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN });
async function redis(command, ...args) { const { url, token } = cfg(); if (!url || !token) throw new Error('storage_not_configured'); const r = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'storage_error'); return d.result; }
function key(a, b) { return `retzef:chat:${[a, b].sort().join(':')}`; }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); const me = cookie(req, 'retzef_profile_id'); if (!me) return res.status(401).json({ error: 'tiktok_login_required' });
  try {
    const input = req.method === 'POST' ? body(req) : req.query; const other = String(input.username || '').replace(/^@/, '').toLowerCase();
    if (!other || other === me) return res.status(400).json({ error: 'user_required' });
    const accepted = await redis('sismember', `retzef:chat:accepted:${me}`, other);
    if (Number(accepted) !== 1 && accepted !== true) return res.status(403).json({ error: 'chat_not_approved' });
    if (req.method === 'GET') { const rows = await redis('lrange', key(me, other), '0', '99'); return res.status(200).json({ messages: (rows || []).reverse().map(x => { try { return JSON.parse(x); } catch (_) { return null; } }).filter(Boolean) }); }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const message = String(input.message || '').trim().slice(0, 2000); if (!message) return res.status(400).json({ error: 'message_required' });
    const item = JSON.stringify({ from: me, to: other, message, createdAt: new Date().toISOString() }); await redis('lpush', key(me, other), item); await redis('ltrim', key(me, other), '0', '199'); await sendTo(other, { title: `הודעה חדשה מ־@${me}`, body: message.slice(0, 120), url: '/' }); return res.status(201).json({ message: JSON.parse(item) });
  } catch (e) { console.error('chat API:', e.message); return res.status(503).json({ error: e.message === 'storage_not_configured' ? e.message : 'storage_error' }); }
};
