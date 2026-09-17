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

const TIER_LABELS = {
  audit: 'Workflow Audit Session',
  frontdesk: 'AI Front Desk',
  setup: 'Full AI Setup',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function receiptHtml({ name, label, amount, dateStr, receiptNumber, reference }) {
  const greetingName = name ? escapeHtml(name) : 'there';
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f7fb;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e4f2;">
          <tr>
            <td style="background:#4338ca;padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.01em;">
                    Talnt<span style="font-weight:600;opacity:0.85;">AI</span>
                  </td>
                  <td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#e3e0fb;text-transform:uppercase;letter-spacing:0.08em;">
                    Receipt
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#14141c;">Hi ${greetingName},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#14141c;line-height:1.5;">Thanks for your payment — here's your receipt.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7fb;border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#4c4c5c;padding:6px 0;">Item</td>
                        <td align="right" style="font-size:14px;color:#14141c;font-weight:600;padding:6px 0;">${escapeHtml(label)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px;color:#4c4c5c;padding:6px 0;border-top:1px solid #e5e4f2;">Amount</td>
                        <td align="right" style="font-size:20px;color:#4338ca;font-weight:800;padding:10px 0 6px;border-top:1px solid #e5e4f2;">${escapeHtml(amount)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px;color:#4c4c5c;padding:6px 0;">Date</td>
                        <td align="right" style="font-size:14px;color:#14141c;padding:6px 0;">${escapeHtml(dateStr)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px;color:#4c4c5c;padding:6px 0;">Receipt No.</td>
                        <td align="right" style="font-size:14px;color:#14141c;font-weight:600;padding:6px 0;">${escapeHtml(receiptNumber)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#8a8996;padding:10px 0 0;">Stripe reference</td>
                        <td align="right" style="font-size:12px;color:#8a8996;padding:10px 0 0;word-break:break-all;">${escapeHtml(reference)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:15px;color:#14141c;line-height:1.5;">We'll follow up within one business day to get started.</p>
              <p style="margin:16px 0 0;font-size:14px;color:#4c4c5c;line-height:1.5;">Questions? Just reply to this email, or call <a href="tel:+15808256824" style="color:#4338ca;text-decoration:none;font-weight:600;">580-TALNT-AI</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f7f7fb;border-top:1px solid #e5e4f2;">
              <p style="margin:0;font-size:12px;color:#8a8996;line-height:1.6;">
                Talnt AI &middot; <a href="tel:+15808256824" style="color:#8a8996;text-decoration:none;">580-825-6824</a> &middot; <a href="mailto:setup@talntai.com" style="color:#8a8996;text-decoration:none;">setup@talntai.com</a><br>
                <a href="https://www.talntai.com" style="color:#8a8996;text-decoration:none;">talntai.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendCustomerReceipt(session) {
  const apiKey = process.env.RESEND_API_KEY;
  const email = session.customer_details && session.customer_details.email;
  if (!apiKey || !email) return;

  const tier = (session.metadata && session.metadata.tier) || 'unknown';
  const label = TIER_LABELS[tier] || 'Talnt AI';
  const amount = session.amount_total != null ? `$${(session.amount_total / 100).toFixed(2)}` : 'n/a';
  const name = session.customer_details.name || '';
  const createdMs = session.created ? session.created * 1000 : Date.now();
  const dateObj = new Date(createdMs);
  const dateStr = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const datePart = dateObj.toISOString().slice(0, 10).replace(/-/g, '');
  const shortCode = (session.payment_intent || session.id).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  const receiptNumber = `TAI-${datePart}-${shortCode}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Talnt AI <setup@talntai.com>',
      to: [email],
      subject: `Your receipt: ${label} — ${amount}`,
      html: receiptHtml({ name, label, amount, dateStr, receiptNumber, reference: session.id }),
      text: [
        `Hi${name ? ` ${name}` : ''},`,
        '',
        `Thanks for your payment — here's your receipt.`,
        '',
        `Item: ${label}`,
        `Amount: ${amount}`,
        `Date: ${dateStr}`,
        `Receipt No.: ${receiptNumber}`,
        `Stripe reference: ${session.id}`,
        '',
        `We'll follow up within one business day to get started.`,
        '',
        `Questions? Reply to this email or call 580-TALNT-AI (580-825-6824).`,
        '',
        `Talnt AI`,
        `https://www.talntai.com`,
      ].join('\n'),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend receipt send failed: ${res.status} ${await res.text()}`);
  }
}

async function sendPaymentNotification(session) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const notifyTo = process.env.LEAD_NOTIFICATION_EMAIL || 'setup@talntai.com';
  const tier = (session.metadata && session.metadata.tier) || 'unknown';
  const amount = session.amount_total != null ? `$${(session.amount_total / 100).toFixed(2)}` : 'n/a';
  const details = session.customer_details || {};
  const email = details.email;
  const phone = details.phone;
  const addr = details.address;
  const address = addr
    ? [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
        .filter(Boolean)
        .join(', ')
    : null;

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
        `Customer name: ${details.name || '(none provided)'}`,
        `Customer email: ${email || '(none provided)'}`,
        `Customer phone: ${phone || '(none provided)'}`,
        `Billing address: ${address || '(none provided)'}`,
        `Stripe session: ${session.id}`,
        `Mode: ${session.mode}`,
      ].join('\n'),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}

async function sendRefundNotification(charge) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const notifyTo = process.env.LEAD_NOTIFICATION_EMAIL || 'setup@talntai.com';
  const tier = (charge.metadata && charge.metadata.tier) || 'unknown';
  const refunded = `$${(charge.amount_refunded / 100).toFixed(2)}`;
  const total = `$${(charge.amount / 100).toFixed(2)}`;
  const isFull = charge.amount_refunded === charge.amount;
  const billing = charge.billing_details || {};
  const email = billing.email || charge.receipt_email;

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
      subject: `Refund issued: ${tier} (${refunded}${isFull ? '' : ` of ${total}`})`,
      text: [
        `Offer: ${tier}`,
        `${isFull ? 'Fully refunded' : 'Partially refunded'}: ${refunded}${isFull ? '' : ` of ${total}`}`,
        `Customer name: ${billing.name || '(none provided)'}`,
        `Customer email: ${email || '(none provided)'}`,
        `Customer phone: ${billing.phone || '(none provided)'}`,
        `Charge: ${charge.id}`,
      ].join('\n'),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend refund notification failed: ${res.status} ${await res.text()}`);
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
      try {
        await sendCustomerReceipt(session);
      } catch (err) {
        console.error('Customer receipt failed:', err);
      }
    }
  }

  // Fires on both full and partial refunds, however they're issued —
  // including refunding directly from the Stripe Dashboard, not just ones
  // triggered through our own code.
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    try {
      await sendRefundNotification(charge);
    } catch (err) {
      console.error('Refund notification failed:', err);
    }
  }

  return res.status(200).json({ received: true });
};
