const PREFIX = 'retzef:profile:';
function cookie(req, name) { const raw = req.headers.cookie || ''; const hit = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '=')); return hit ? decodeURIComponent(hit.slice(name.length + 1)) : ''; }
function body(req) { if (!req.body) return {}; if (typeof req.body === 'object') return req.body; try { return JSON.parse(req.body); } catch (_) { return {}; } }
function cfg() { return { url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN }; }
async function redis(command, ...args) { const { url, token } = cfg(); if (!url || !token) throw new Error('storage_not_configured'); const r = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'storage_error'); return d.result; }
async function profile(username) { const raw = await redis('get', `${PREFIX}${username.toLowerCase()}`); return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; }
function publicUser(p) { return { username: p.username, displayName: p.displayName || p.username, avatarUrl: p.avatarUrl || '', role: p.role || 'member', online: Date.now() - Number(p.lastSeen || 0) < 120000, statusVisible: p.privacy?.statusVisible !== false, subscriptionVisible: p.privacy?.subscriptionVisible === true }; }
function knownStatus(username) { const known = { 'ban.real': 'בעלים', 'oobbn98': 'הכול טוב', 'dahan324': 'סבבה', 'albinocapybara': 'הכול טוב', 'user1691117561269': 'הכול טוב' }; return known[String(username || '').toLowerCase()] || ''; }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const me = cookie(req, 'retzef_profile_id').toLowerCase();
  if (!me) return res.status(401).json({ error: 'tiktok_login_required' });
  try {
    const mine = await profile(me); if (!mine) return res.status(401).json({ error: 'tiktok_login_required' });
    if (req.method === 'GET') {
      const scan = await redis('scan', '0', 'match', `${PREFIX}*`, 'count', '100');
      const keys = Array.isArray(scan) && Array.isArray(scan[1]) ? scan[1] : [];
      const users = (await Promise.all(keys.slice(0, 100).map(k => profile(k.slice(PREFIX.length))))).filter(Boolean).filter(p => String(p.username).toLowerCase() !== me);
      const visibleUsers = await Promise.all(users.map(async p => { const approved = await redis('sismember', `retzef:chat:accepted:${me}`, String(p.username).toLowerCase()); const result = { ...publicUser(p), chatApproved: String(approved) === '1' || approved === true }; if (result.chatApproved && result.statusVisible) result.status = p.status || knownStatus(p.username); if (result.chatApproved && result.subscriptionVisible) result.subscription = p.subscription || p.subscriptionName || ''; return result; }));
      const requests = await redis('lrange', `retzef:chat:requests:${me}`, '0', '49');
      return res.status(200).json({ me: publicUser(mine), users: visibleUsers, requests: (requests || []).map(x => { try { return JSON.parse(x); } catch (_) { return null; } }).filter(Boolean) });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const input = body(req); const action = String(input.action || '');
    if (action === 'privacy') {
      mine.privacy = { statusVisible: input.statusVisible !== false, subscriptionVisible: input.subscriptionVisible === true };
      await redis('set', `${PREFIX}${me}`, JSON.stringify(mine)); return res.status(200).json({ privacy: mine.privacy });
    }
    const target = String(input.username || '').replace(/^@/, '').trim().toLowerCase();
    if (!target || target === me || !(await profile(target))) return res.status(404).json({ error: 'user_not_found' });
    if (action === 'request') {
      const item = JSON.stringify({ from: me, createdAt: new Date().toISOString() }); await redis('lpush', `retzef:chat:requests:${target}`, item); return res.status(201).json({ sent: true });
    }
    if (action === 'accept' || action === 'deny') {
      const rows = await redis('lrange', `retzef:chat:requests:${me}`, '0', '99'); const kept = []; let found = false;
      for (const row of rows || []) { let item; try { item = JSON.parse(row); } catch (_) { kept.push(row); continue; } if (item.from === target && !found) { found = true; continue; } kept.push(row); }
      await redis('del', `retzef:chat:requests:${me}`); for (let i = kept.length - 1; i >= 0; i--) await redis('rpush', `retzef:chat:requests:${me}`, kept[i]);
      if (!found) return res.status(404).json({ error: 'request_not_found' });
      if (action === 'accept') { await redis('sadd', `retzef:chat:accepted:${me}`, target); await redis('sadd', `retzef:chat:accepted:${target}`, me); }
      return res.status(200).json({ accepted: action === 'accept' });
    }
    return res.status(400).json({ error: 'invalid_action' });
  } catch (e) { console.error('users API:', e.message); return res.status(503).json({ error: e.message === 'storage_not_configured' ? e.message : 'storage_error' }); }
};
