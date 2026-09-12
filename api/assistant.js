module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const key = process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY;
  const configuredBase = process.env.OPENAI_API_BASE || process.env.BUILT_IN_FORGE_API_URL || 'https://api.openai.com/v1';
  if (!key) return res.status(503).json({ error: 'ai_not_configured' });
  try {
    const input = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const system = String(input.system || '').slice(0, 20000);
    const messages = Array.isArray(input.messages) ? input.messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) })) : [];
    if (!messages.length) return res.status(400).json({ error: 'messages_required' });
    const base = configuredBase.replace(/\/$/, '');
    const endpoint = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-5-mini', messages: [{ role: 'system', content: system }, ...messages], max_completion_tokens: 700 }) });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'ai_provider_error' });
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(502).json({ error: 'ai_empty_response' });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('assistant api error', error.message);
    return res.status(500).json({ error: 'ai_request_failed' });
  }
};
