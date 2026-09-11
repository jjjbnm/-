const params = new URLSearchParams({
  tiktok_ok: '1',
  username,
  display_name: (user && user.display_name) || username,
  avatar: (user && user.avatar_url) || '',
  role: resolveRole(username),
});
