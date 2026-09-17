// Tiers are defined once here. `envFlag: null` means always available;
// otherwise self-checkout for that tier only works once the named env var
// is set to 'true' in Vercel — that's the whole "switch."
const TIERS = {
  audit: {
    mode: 'payment',
    envFlag: null,
    priceEnvVars: ['STRIPE_PRICE_AUDIT'],
  },
  frontdesk: {
    mode: 'subscription',
    envFlag: 'CHECKOUT_FRONTDESK_ENABLED',
    // Stripe Checkout allows mixing a one-time price (the $750 setup fee)
    // with the recurring price in a single subscription-mode session.
    priceEnvVars: ['STRIPE_PRICE_FRONTDESK_SETUP', 'STRIPE_PRICE_FRONTDESK_MONTHLY'],
  },
  setup: {
    mode: 'payment',
    envFlag: 'CHECKOUT_SETUP_ENABLED',
    priceEnvVars: ['STRIPE_PRICE_SETUP'],
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const tier = (req.body || {}).tier;
  const config = TIERS[tier];
  if (!config) {
    return res.status(400).json({ ok: false, error: 'Unknown offer' });
  }

  if (config.envFlag && process.env[config.envFlag] !== 'true') {
    return res.status(403).json({ ok: false, error: 'not_open_yet' });
  }

  const prices = config.priceEnvVars.map((name) => process.env[name]);
  if (prices.some((p) => !p)) {
    return res.status(500).json({ ok: false, error: 'Pricing not configured for this offer' });
  }

  const origin = (req.headers.origin || 'https://www.talntai.com').replace(/\/$/, '');

  const params = new URLSearchParams();
  params.set('mode', config.mode);
  params.set('success_url', `${origin}/thank-you.html?tier=${tier}&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/pricing.html`);
  params.set('metadata[tier]', tier);
  params.set('phone_number_collection[enabled]', 'true');
  params.set('billing_address_collection', 'required');
  prices.forEach((price, i) => {
    params.set(`line_items[${i}][price]`, price);
    params.set(`line_items[${i}][quantity]`, '1');
  });

  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return res.status(502).json({ ok: false, error: 'Stripe error', detail: session });
    }

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: String(err) });
  }
};
