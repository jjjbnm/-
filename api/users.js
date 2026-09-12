const PREFIX = 'retzef:profile:';
const { sendTo } = require('../lib/push');
function cookie(req, name) { const raw = req.headers.cookie || ''; const hit = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '=')); return hit ? decodeURIComponent(hit.slice(name.length + 1)) : ''; }
function body(req) { if (!req.body) return {}; if (typeof req.body === 'object') return req.body; try { return JSON.parse(req.body); } catch (_) { return {}; } }
function cfg() { return { url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN }; }
async function redis(command, ...args) { const { url, token } = cfg(); if (!url || !token) throw new Error('storage_not_configured'); const r = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'storage_error'); return d.result; }
async function profile(username) { const raw = await redis('get', `${PREFIX}${username.toLowerCase()}`); return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null; }
function publicUser(p) { return { username: p.username, displayName: p.displayName || p.username, avatarUrl: p.avatarUrl || '', role: p.role || 'member', online: Date.now() - Number(p.lastSeen || 0) < 120000, statusVisible: p.privacy?.statusVisible !== false, subscriptionVisible: p.privacy?.subscriptionVisible === true }; }
function knownStatus(username) { const known = { 'ban.real': 'בעלים', 'oobbn98': 'הכול טוב', 'dahan324': 'סבבה', 'albinocapybara': 'הכול טוב', 'user1691117561269': 'הכול טוב' }; return known[String(username || '').toLowerCase()] || ''; }
async function supportRequests() { const rows = await redis('lrange', 'retzef:support:requests', '0', '99'); return (rows || []).map(x => { try { return JSON.parse(x); } catch (_) { return null; } }).filter(Boolean); }
async function joinRequests() { const rows = await redis('lrange', 'retzef:join:requests', '0', '99'); return (rows || []).map(x => { try { return JSON.parse(x); } catch (_) { return null; } }).filter(Boolean); }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const input = body(req); const action = String(input.action || '');
  if (req.method === 'POST' && action === 'join') {
    try {
      const name = String(input.name || '').trim().slice(0, 60); const age = Number(input.age); const gender = String(input.gender || '').trim();
      if (!name || !Number.isInteger(age) || age < 1 || age > 120 || !['בן', 'בת'].includes(gender)) return res.status(400).json({ error: 'invalid_join_details' });
      const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, age, gender, createdAt: new Date().toISOString(), status: 'new' };
      await redis('lpush', 'retzef:join:requests', JSON.stringify(item)); await redis('ltrim', 'retzef:join:requests', '0', '199'); await sendTo('ban.real', { title: 'בקשת הצטרפות חדשה', body: `${name}, גיל ${age}, ביקש/ה להצטרף`, url: '/' });
      return res.status(201).json({ submitted: true });
    } catch (e) { console.error('join request:', e.message); return res.status(503).json({ error: e.message === 'storage_not_configured' ? e.message : 'storage_error' }); }
  }
  const me = cookie(req, 'retzef_profile_id').toLowerCase();
  if (!me) return res.status(401).json({ error: 'tiktok_login_required' });
  try {
    const mine = await profile(me); if (!mine) return res.status(401).json({ error: 'tiktok_login_required' });
    if (req.method === 'GET') {
      const scan = await redis('scan', '0', 'match', `${PREFIX}*`, 'count', '100');
      const keys = Array.isArray(scan) && Array.isArray(scan[1]) ? scan[1] : [];
      const users = (await Promise.all(keys.slice(0, 100).map(k => profile(k.slice(PREFIX.length))))).filter(Boolean).filter(p => String(p.username).toLowerCase() !== me);
      const visibleUsers = await Promise.all(users.map(async p => { const targetUsername = String(p.username).toLowerCase(); const approved = await redis('sismember', `retzef:chat:accepted:${me}`, targetUsername); const pendingRows = await redis('lrange', `retzef:chat:requests:${targetUsername}`, '0', '49'); const chatPending = (pendingRows || []).some(row => { try { return JSON.parse(row).from === me; } catch (_) { return false; } }); const result = { ...publicUser(p), chatApproved: String(approved) === '1' || approved === true, chatPending }; if (result.chatApproved && result.statusVisible) result.status = p.status || knownStatus(p.username); if (result.chatApproved && result.subscriptionVisible) result.subscription = p.subscription || p.subscriptionName || ''; return result; }));
      const requests = await redis('lrange', `retzef:chat:requests:${me}`, '0', '49');
      const result = { me: { ...publicUser(mine), devicePreferences: mine.devicePreferences || {} }, users: visibleUsers, requests: (requests || []).map(x => { try { return JSON.parse(x); } catch (_) { return null; } }).filter(Boolean) };
      if (['owner', 'admin'].includes(mine.role) || ['user613987579196', 'ban.real', 'shirel'].includes(me)) result.supportRequests = await supportRequests();
      if (['owner', 'admin'].includes(mine.role) || ['user613987579196', 'ban.real', 'shirel'].includes(me)) result.joinRequests = await joinRequests();
      return res.status(200).json(result);
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (action === 'privacy') {
      mine.privacy = { statusVisible: input.statusVisible !== false, subscriptionVisible: input.subscriptionVisible === true };
      await redis('set', `${PREFIX}${me}`, JSON.stringify(mine)); return res.status(200).json({ privacy: mine.privacy });
    }
    if (action === 'devicePreferences') {
      mine.devicePreferences = { reduceMotion: input.reduceMotion === true, notifications: input.notifications === true };
      await redis('set', `${PREFIX}${me}`, JSON.stringify(mine)); return res.status(200).json({ devicePreferences: mine.devicePreferences });
    }
    if (action === 'support') {
      const quote = String(input.quote || '').trim().slice(0, 2000); if (!quote) return res.status(400).json({ error: 'quote_required' });
      const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, from: me, displayName: mine.displayName || me, quote, createdAt: new Date().toISOString(), status: 'new' };
      await redis('lpush', 'retzef:support:requests', JSON.stringify(item)); await redis('ltrim', 'retzef:support:requests', '0', '199');
      await sendTo('user613987579196', { title: 'פניית תמיכה חדשה', body: `פנייה חדשה מ־@${me}`, url: '/' });
      return res.status(201).json({ forwarded: true, request: item });
    }
    const target = String(input.username || '').replace(/^@/, '').trim().toLowerCase();
    if (!target || target === me || !(await profile(target))) return res.status(404).json({ error: 'user_not_found' });
    if (action === 'request') {
      const existingRows = await redis('lrange', `retzef:chat:requests:${target}`, '0', '49');
      if ((existingRows || []).some(row => { try { return JSON.parse(row).from === me; } catch (_) { return false; } })) return res.status(200).json({ sent: true, pending: true });
      const item = JSON.stringify({ from: me, createdAt: new Date().toISOString() }); await redis('lpush', `retzef:chat:requests:${target}`, item); await sendTo(target, { title: 'בקשת צ׳אט חדשה', body: `@${me} רוצה להתחיל צ׳אט איתך`, url: '/' }); return res.status(201).json({ sent: true, pending: true });
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
