module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const key = process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY;
  const configuredBase = process.env.OPENAI_API_BASE || process.env.BUILT_IN_FORGE_API_URL || 'https://api.openai.com/v1';
  if (!key) return res.status(503).json({ error: 'ai_not_configured' });
  try {
    const input = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const question = String(input.message || '').trim().slice(0, 2000);
    if (!question) return res.status(400).json({ error: 'message_required' });
    const base = configuredBase.replace(/\/$/, '');
    const endpoint = base.endsWith('/v1') ? base + '/chat/completions' : base + '/v1/chat/completions';
    const system = 'אתה העוזר של רצף. ענה בעברית, ישירות ובקצרה, בלי להציג סיכום קבוע. עזור בנושאי חוקים, סטטוס, מנויים, חנות, לוחות, TikTok והאתר. אם שואלים איזה מנוי יש למשתמש, אל תמציא מידע אם הוא לא קיים. חוקים: לא לספים, לא לקלל, לא לשנות שם או תמונת קבוצה, ואיסור הזכרת מדינות מסוימות. בעלים: הבאן המקורי; מנהלת: shirel.';
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-5-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: question }], max_completion_tokens: 500 }) });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'ai_provider_error' });
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) return res.status(502).json({ error: 'ai_empty_response' });
    return res.status(200).json({ answer });
  } catch (error) { return res.status(500).json({ error: 'ai_request_failed' }); }
};
