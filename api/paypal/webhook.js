// Receives real-time events from PayPal (subscription activated/cancelled,
// payment failed, etc). Register this URL in PayPal Developer Dashboard →
// your app → Webhooks: https://your-domain.vercel.app/api/paypal/webhook
// Subscribe to: BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED,
// BILLING.SUBSCRIPTION.SUSPENDED, BILLING.SUBSCRIPTION.EXPIRED,
// PAYMENT.SALE.COMPLETED, PAYMENT.SALE.DENIED
//
// IMPORTANT LIMITATION: this project has no database. This handler logs
// every event so you can see it in Vercel → Logs, but it cannot push a
// status update to a specific visitor's browser on its own — the site
// checks status itself via api/paypal/subscription-status.js (polling),
// using the subscription ID saved in the visitor's own localStorage.
// A real multi-device "the site auto-updates for everyone" requires adding
// a database (e.g. Vercel KV/Postgres) keyed by subscription ID — this
// file is written so that's a small addition later, not a rewrite.
// Path: api/paypal/webhook.js

module.exports = async (req, res) => {
  try {
    const event = req.body;
    console.log('PayPal webhook received:', event && event.event_type, JSON.stringify(event && event.resource && event.resource.id));

    switch (event && event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        console.log('Subscription activated:', event.resource.id);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        console.log('Subscription cancelled:', event.resource.id);
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        console.log('Subscription suspended:', event.resource.id);
        break;
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        console.log('Subscription expired:', event.resource.id);
        break;
      case 'PAYMENT.SALE.DENIED':
        console.log('Recurring payment failed:', event.resource.id);
        break;
      default:
        console.log('Unhandled event type:', event && event.event_type);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
