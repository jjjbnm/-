// TikTok OAuth callback for Vercel: api/callback.js
const ROLES = {
  'your_tiktok_username_here': 'owner',
};
function resolveRole(username) {
  if (!username) return 'member';
  return ROLES[username.toLowerCase()] || 'member';
}

module.exports = async (req, res) => {
  const { code, error: tiktokError } = req.query;
  if (tiktokError) return res.redirect(302, `/?tiktok_error=${encodeURIComponent(tiktokError)}`);
  if (!code) return res.redirect(302, '/?tiktok_error=missing_code');

  const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
  const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
  const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI;
  if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
    return res.redirect(302, '/?tiktok_error=server_not_configured');
  }

  try {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect(302, '/?tiktok_error=token_exchange_failed');

    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const userData = await userRes.json();
    const user = userData?.data?.user || {};
    if (userData?.error?.code) {
      console.error('TikTok user info error:', userData);
      return res.redirect(302, `/?tiktok_error=${encodeURIComponent(userData.error.code)}`);
    }
    const displayName = user.display_name || user.username || '';
    const username = user.username || displayName || user.open_id || '';
    const params = new URLSearchParams({
      tiktok_ok: '1',
      username,
      display_name: displayName,
      avatar: user.avatar_url || '',
      role: resolveRole(username),
    });
    return res.redirect(302, `/?${params.toString()}`);
  } catch (err) {
    console.error('TikTok callback error:', err);
    return res.redirect(302, '/?tiktok_error=server_error');
  }
};
