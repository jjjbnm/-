// Switch between TikTok profiles that were already authenticated on this device.
// The profile must already exist in KV; no TikTok credentials are accepted here.
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const item = raw.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}

async function kv(command, ...args) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('profile_storage_not_configured');
  const response = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'storage_error');
  return data.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const username = String(req.body?.username || '').replace(/^@/, '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,128}$/.test(username)) return res.status(400).json({ error: 'invalid_username' });
  try {
    const raw = await kv('get', `retzef:profile:${username}`);
    const profile = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!profile) return res.status(404).json({ error: 'profile_not_found' });
    if (profile.banned === true) return res.status(403).json({ error: 'account_banned' });
    res.setHeader('Set-Cookie', `retzef_profile_id=${encodeURIComponent(username)}; Path=/; Max-Age=31536000; Secure; SameSite=Lax`);
    return res.status(200).json({ ok: true, username });
  } catch (error) {
    console.error('switch-account error:', error.message);
    return res.status(503).json({ error: 'switch_account_failed' });
  }
};
