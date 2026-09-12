// Shared announcement and update boards backed by Upstash Redis REST.
// Required: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL + KV_REST_API_TOKEN).
const BOARD_KEYS = { announcements: 'retzef:board:announcements', updates: 'retzef:board:updates' };

function storageConfig() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}
async function redis(command, ...args) {
  const { url, token } = storageConfig();
  if (!url || !token) throw new Error('storage_not_configured');
  const response = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'storage_error');
  return data.result;
}
function bodyOf(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}
function clean(value, max = 2000) {
  return String(value || '').trim().slice(0, max);
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const board = req.query.board === 'updates' ? 'updates' : 'announcements';
  try {
    if (req.method === 'GET') {
      const rows = await redis('lrange', BOARD_KEYS[board], '0', '49');
      const items = (rows || []).map(row => { try { return JSON.parse(row); } catch (_) { return null; } }).filter(Boolean);
      return res.status(200).json({ board, items });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const input = bodyOf(req);
    const description = clean(input.description, 300);
    const content = clean(input.content, 5000);
    const category = clean(input.category, 80);
    if (!description || !content || !category) return res.status(400).json({ error: 'description_content_category_required' });
    const updatesCode = process.env.UPDATES_BOARD_CODE || 'מודעות9באן';
    const acceptedUpdateCodes = new Set([updatesCode, 'מודעות9באן']);
    if (board === 'updates' && !acceptedUpdateCodes.has(clean(input.code, 200))) {
      return res.status(403).json({ error: 'invalid_update_code' });
    }
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description, content, category,
      codeRequired: board === 'updates',
      publishedAt: clean(input.publishedAt, 40),
      expiresAt: clean(input.expiresAt, 40),
      link: clean(input.link, 500),
      image: clean(input.image, 500),
      author: clean(input.author, 100) || 'קהילת רצף',
      createdAt: new Date().toISOString(),
    };
    await redis('lpush', BOARD_KEYS[board], JSON.stringify(item));
    return res.status(201).json({ item });
  } catch (error) {
    console.error('boards API error:', error.message);
    return res.status(503).json({ error: error.message === 'storage_not_configured' ? 'storage_not_configured' : 'storage_error' });
  }
};
