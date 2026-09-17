const crypto = require('crypto');

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Verifies Stripe's webhook signing scheme by hand (t=timestamp,v1=hmac)
// so this stays dependency-free, matching the rest of this site's /api.
function isValidStripeSignature(rawBody, sigHeader, secret, toleranceSeconds = 300) {
  if (!sigHeader) return false;
  const parts = {};
  sigHeader.split(',').forEach((kv) => {
    const [k, v] = kv.split('=');
    parts[k] = v;
  });
  if (!parts.t || !parts.v1) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody}`, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(parts.v1, 'utf8');
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return false;
  }

  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  return age <= toleranceSeconds;
}

async function sendPaymentNotification(session) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const notifyTo = process.env.LEAD_NOTIFICATION_EMAIL || 'setup@talntai.com';
  const tier = (session.metadata && session.metadata.tier) || 'unknown';
  const amount = session.amount_total != null ? `$${(session.amount_total / 100).toFixed(2)}` : 'n/a';
  const email = session.customer_details && session.customer_details.email;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Talnt AI Website <notifications@talntai.com>',
      to: [notifyTo],
      reply_to: email || undefined,
      subject: `Payment received: ${tier} (${amount})`,
      text: [
        `Offer: ${tier}`,
        `Amount: ${amount}`,
        `Customer email: ${email || '(none provided)'}`,
        `Stripe session: ${session.id}`,
        `Mode: ${session.mode}`,
      ].join('\n'),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  if (!isValidStripeSignature(rawBody.toString('utf8'), sig, secret)) {
    return res.status(400).json({ ok: false, error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  // checkout.session.completed fires immediately for card payments.
  // ACH ("us_bank_account") settles a few days later — Stripe fires
  // async_payment_succeeded once the bank transfer actually clears, and
  // async_payment_failed if it bounces. Listen for all three in the
  // Stripe Dashboard so ACH orders get confirmed (or flagged) correctly.
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object;
    if (session.payment_status === 'paid' || event.type === 'checkout.session.async_payment_succeeded') {
      try {
        await sendPaymentNotification(session);
      } catch (err) {
        console.error('Payment notification failed:', err);
      }
    }
  }

  return res.status(200).json({ received: true });
};
