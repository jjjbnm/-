const GEO_TIMEOUT_MS = 5000;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ allowed: false, error: 'method_not_allowed' });

  try {
    const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
    const clientIp = String(forwarded).split(',')[0].trim();
    if (!clientIp) return res.status(503).json({ allowed: false, error: 'client_ip_unknown' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(clientIp)}/json/`, {
      headers: { Accept: 'application/json', 'User-Agent': 'retzef-support-access-check/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`geo_provider_${response.status}`);
    const geo = await response.json();
    const countryCode = String(geo.country_code || '').toUpperCase();
    if (!countryCode) throw new Error('country_unknown');

    res.setHeader('Cache-Control', 'no-store');
    if (countryCode !== 'IL') {
      return res.status(403).json({ allowed: false, error: 'region_not_allowed', countryCode });
    }
    return res.status(200).json({ allowed: true, countryCode: 'IL' });
  } catch (error) {
    return res.status(503).json({ allowed: false, error: 'region_check_failed' });
  }
}
