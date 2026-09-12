function cookie(req, name) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)).toLowerCase() : '';
}
function body(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}
const cfg = () => ({ url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN });
async function redis(command, ...args) {
  const { url, token } = cfg();
  if (!url || !token) throw new Error('storage_not_configured');
  const r = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || 'storage_error');
  return d.result;
}
async function getProfile(username) {
  const raw = await redis('get', `retzef:profile:${username}`);
  return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
}
async function notifySupport(payload) {
  try {
    const { sendTo } = require('../lib/push');
    await sendTo('user613987579196', { title: 'פניית תמיכה חדשה', body: `פנייה חדשה מ־@${payload.from}`, url: '/' });
  } catch (_) {}
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const me = cookie(req, 'retzef_profile_id');
  if (!me) return res.status(401).json({ error: 'tiktok_login_required' });
  try {
    const mine = await getProfile(me);
    if (!mine) return res.status(401).json({ error: 'tiktok_login_required' });
    if (req.method === 'POST') {
      const input = body(req);
      const quote = String(input.quote || '').trim().slice(0, 2000);
      if (!quote) return res.status(400).json({ error: 'quote_required' });
      const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, from: me, displayName: mine.displayName || me, quote, createdAt: new Date().toISOString(), status: 'new' };
      await redis('lpush', 'retzef:support:requests', JSON.stringify(item));
      await redis('ltrim', 'retzef:support:requests', '0', '199');
      await notifySupport(item);
      return res.status(201).json({ forwarded: true, request: item });
    }
    if (req.method === 'GET') {
      if (!['owner', 'admin'].includes(mine.role) && !['user613987579196', 'ban.real', 'shirel'].includes(me)) return res.status(403).json({ error: 'support_admin_only' });
      const rows = await redis('lrange', 'retzef:support:requests', '0', '99');
      return res.status(200).json({ requests: (rows || []).map(row => { try { return JSON.parse(row); } catch (_) { return null; } }).filter(Boolean) });
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (error) {
    console.error('support API:', error.message);
    return res.status(503).json({ error: error.message === 'storage_not_configured' ? error.message : 'storage_error' });
  }
};
