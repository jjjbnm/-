// TikTok OAuth callback — runs on the server, never in the browser.
// Path in GitHub must be exactly: api/callback.js
// Deploy the repo to Vercel; Vercel auto-detects files under /api
// as serverless functions, so this becomes: https://your-domain.com/api/callback
//
// Scope requested by the front end is user.info.basic only — this endpoint
// can read a public username/display name/avatar. It cannot post, message,
// follow, or take any action on the person's TikTok account.

// Roles are NOT something TikTok's API knows about — TikTok only returns
// public profile info. To answer "is this person a regular member, admin,
// or owner in OUR group", you maintain that mapping yourselves, here, by
// TikTok username (lowercase). Update this object whenever your admin
// list changes, then redeploy.
const ROLES = {
  // 'tiktok_username': 'owner' | 'admin'
  'your_tiktok_username_here': 'owner', // הבאן המקורי — עדכן ל-@ המדויק שלך ב-TikTok (לא שם התצוגה), אותיות קטנות
  // 'shirel_username': 'admin',
};
function resolveRole(username) {
  if (!username) return 'member';
  return ROLES[username.toLowerCase()] || 'member';
}

module.exports = async (req, res) => {
  const { code, error: tiktokError } = req.query;

  if (tiktokError) {
    return res.redirect(302, `/?tiktok_error=${encodeURIComponent(tiktokError)}`);
  }
  if (!code) {
    return res.redirect(302, '/?tiktok_error=missing_code');
  }

  const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
  const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
  const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI; // must match exactly what's registered in the TikTok app

  if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
    console.error('Missing TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI env vars');
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

    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect(302, '/?tiktok_error=token_exchange_failed');
    }

    const userRes = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );
    const userData = await userRes.json();
    const user = userData && userData.data && userData.data.user;
    const username = (user && (user.username || user.display_name)) || '';

    const params = new URLSearchParams({
      tiktok_ok: '1',
      username,
      avatar: (user && user.avatar_url) || '',
      role: resolveRole(username),
    });
    return res.redirect(302, `/?${params.toString()}`);
  } catch (err) {
    console.error('TikTok callback error:', err);
    return res.redirect(302, '/?tiktok_error=server_error');
  }
};
