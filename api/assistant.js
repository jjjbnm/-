function localAnswer(question) {
  const text = String(question || '').toLowerCase();
  if (/^\s*(היי|שלום|הי|אהלן)/.test(text)) return 'היי! אני העוזר של רצף, איך אפשר לעזור?';
  if (/גיל|בן כמה|גיל כניסה|לאיזה גיל/.test(text)) return 'גיל הכניסה לקבוצה הוא 15- כרגע, והוא יעלה ל-16- בשנת 2027.';
  if (/מי הבעלים|בעלים/.test(text)) return 'בעל הקבוצה הוא הבאן המקורי 👑.';
  if (/מנהלת|מנהל/.test(text)) return 'המנהלת היא shirel 👩‍💼.';
  if (/חוק|חוקים/.test(text)) return 'החוקים המרכזיים: לא לספים, לא לקלל, לא לשנות את שם או תמונת הקבוצה, ואסור להזכיר את המדינות האסורות לפי חוקי הקבוצה.';
  return 'כרגע אין חיבור לעוזר החכם. אפשר לשאול אותי על גיל הכניסה, חוקים, סטטוס, מנויים, חנות או לוחות.';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const input = typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const question = String(input.message || '').trim().slice(0, 2000);
    if (!question) return res.status(400).json({ error: 'message_required' });
    const key = process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY;
    if (!key) return res.status(200).json({ answer: localAnswer(question) });
    const configuredBase = process.env.OPENAI_API_BASE || process.env.BUILT_IN_FORGE_API_URL || 'https://api.openai.com/v1';
    const base = configuredBase.replace(/\/$/, '');
    const endpoint = base.endsWith('/v1') ? base + '/chat/completions' : base + '/v1/chat/completions';
    const system = 'אתה העוזר של רצף. ענה בעברית, ישירות ובקצרה, בלי להציג סיכום קבוע. עזור בנושאי חוקים, סטטוס, מנויים, חנות, לוחות, TikTok והאתר. אם שואלים איזה מנוי יש למשתמש, אל תמציא מידע אם הוא לא קיים. גיל הכניסה הוא 15- כרגע ו-16- ב-2027. בעלים: הבאן המקורי; מנהלת: shirel.';
    const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-5-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: question }], max_completion_tokens: 500 }) });
    const data = await response.json();
    if (!response.ok) return res.status(200).json({ answer: localAnswer(question) });
    const answer = data.choices?.[0]?.message?.content;
    return res.status(200).json({ answer: answer || localAnswer(question) });
  } catch (error) {
    console.error('assistant api error', error.message);
    let question = '';
    try { question = typeof req.body === 'object' ? req.body.message : JSON.parse(req.body || '{}').message; } catch (_) {}
    return res.status(200).json({ answer: localAnswer(question) });
  }
};
