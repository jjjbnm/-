// ONE-TIME SETUP endpoint — visit this URL once in a browser after deploying.
// It creates a PayPal Product + all subscription Plans your site needs, and
// returns their IDs as JSON. Copy those IDs into the PLAN_IDS object in
// retzef.html (front-end script) — that's the only manual step, because
// PayPal requires Plans to exist before any subscribe button can use them.
// Path: api/paypal/create-plans.js

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
  if (!data.access_token) throw new Error('Failed to get PayPal access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function createProduct(token) {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/catalogs/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'רצף — מנויים',
      description: 'מנויי קבוצת רצף',
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error('Failed to create product: ' + JSON.stringify(data));
  return data.id;
}

async function createPlan(token, productId, name, price, intervalUnit, intervalCount) {
  const res = await fetch(`${PAYPAL_API_BASE}/v1/billing/plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: productId,
      name,
      billing_cycles: [{
        frequency: { interval_unit: intervalUnit, interval_count: intervalCount },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // 0 = infinite, renews until cancelled
        pricing_scheme: { fixed_price: { value: price.toFixed(2), currency_code: 'ILS' } },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Failed to create plan "${name}": ` + JSON.stringify(data));
  return data.id;
}

module.exports = async (req, res) => {
  try {
    const token = await getAccessToken();
    const productId = await createProduct(token);

    const plans = {};
    // מנוי סרטון (חודשי בלבד)
    plans.video_regular_month = await createPlan(token, productId, 'מנוי סרטון רגיל - חודשי', 2.5, 'MONTH', 1);
    plans.video_plus_month = await createPlan(token, productId, 'מנוי סרטון פלוס - חודשי', 5, 'MONTH', 1);
    // רצף פלוס — כל תקופות החיוב
    plans.retzef_plus_day = await createPlan(token, productId, 'רצף פלוס - יומי', 0.5, 'DAY', 1);
    plans.retzef_plus_week = await createPlan(token, productId, 'רצף פלוס - שבועי', 2.48, 'WEEK', 1);
    plans.retzef_plus_month = await createPlan(token, productId, 'רצף פלוס - חודשי', 6.22, 'MONTH', 1);
    plans.retzef_plus_year = await createPlan(token, productId, 'רצף פלוס - שנתי', 9, 'YEAR', 1);
    // רצף פלוס פרימיום — כל תקופות החיוב
    plans.retzef_premium_day = await createPlan(token, productId, 'רצף פלוס פרימיום - יומי', 1, 'DAY', 1);
    plans.retzef_premium_week = await createPlan(token, productId, 'רצף פלוס פרימיום - שבועי', 4.97, 'WEEK', 1);
    plans.retzef_premium_month = await createPlan(token, productId, 'רצף פלוס פרימיום - חודשי', 9, 'MONTH', 1);
    plans.retzef_premium_year = await createPlan(token, productId, 'רצף פלוס פרימיום - שנתי', 10, 'YEAR', 1);

    return res.status(200).json({
      success: true,
      product_id: productId,
      plans,
      next_step: 'העתיקו את כל האובייקט "plans" והדביקו אותו בתוך PLAN_IDS ב-retzef.html',
    });
  } catch (err) {
    console.error('create-plans error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
