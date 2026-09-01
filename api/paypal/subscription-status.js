// Checks the live status of a subscription directly against PayPal.
// GET /api/paypal/subscription-status?id=SUBSCRIPTION_ID
// Path: api/paypal/subscription-status.js

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get PayPal access token');
  return data.access_token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing subscription id' });
  try {
    const token = await getAccessToken();
    const subRes = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await subRes.json();
    return res.status(200).json({
      status: data.status || 'UNKNOWN', // ACTIVE, CANCELLED, SUSPENDED, EXPIRED, APPROVAL_PENDING
      plan_id: data.plan_id,
      next_billing_time: data.billing_info && data.billing_info.next_billing_time,
    });
  } catch (err) {
    console.error('subscription-status error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
