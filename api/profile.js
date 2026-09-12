// Shared TikTok profile storage for Vercel KV/Redis REST.
// Required environment variables: KV_REST_API_URL and KV_REST_API_TOKEN.
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
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
  const username = getCookie(req, 'retzef_profile_id');
  if (!username) return res.status(401).json({ error: 'not_authenticated' });
  try {
    const profileRaw = await kv('get', `retzef:profile:${username.toLowerCase()}`);
    const profile = typeof profileRaw === 'string' ? JSON.parse(profileRaw) : profileRaw;
    if (!profile) return res.status(404).json({ error: 'profile_not_found' });
    profile.lastSeen = Date.now();
    await kv('set', `retzef:profile:${username.toLowerCase()}`, JSON.stringify(profile));
    return res.status(200).json({ profile });
  } catch (error) {
    console.error('profile API error:', error.message);
    return res.status(503).json({ error: error.message === 'profile_storage_not_configured' ? 'profile_storage_not_configured' : 'storage_error' });
  }
};
