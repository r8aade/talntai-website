async function sendLeadNotification(body) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const notifyTo = process.env.LEAD_NOTIFICATION_EMAIL || 'setup@talntai.com';
  const email = (body.email || '').trim();

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
      subject: `New lead: ${body.offer || 'Talnt AI'} (${body.business || 'unspecified business'})`,
      text: [
        `Name: ${body.name || '(not specified)'}`,
        `Offer: ${body.offer || '(not specified)'}`,
        `Business type: ${body.business || '(not specified)'}`,
        `Company: ${body.company || '(not specified)'}`,
        `Phone: ${body.phone || '(not specified)'}`,
        `Timezone: ${body.timezone || '(not specified)'}`,
        `Tools used: ${body.tools || '(none provided)'}`,
        `Notes: ${body.notes || '(none provided)'}`,
        `Email: ${email || '(none provided)'}`,
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
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: 'Server not configured' });
  }

  const body = req.body || {};

  // Bot check: honeypot field bots tend to fill, plus a minimum time-on-page.
  // Both fail silently with a fake success so bots don't learn to adapt.
  const submittedAt = Number(body.ts);
  const tooFast = !submittedAt || Date.now() - submittedAt < 2000;
  if (body.hp_website || tooFast) {
    return res.status(200).json({ ok: true });
  }

  const email = (body.email || '').trim();
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email is required' });
  }

  // timezone has no dedicated HubSpot property yet (would need one created
  // in Settings > Properties first — sending an unrecognized property name
  // fails the whole request), so it rides along in tools_used for now.
  const toolsUsed = [
    body.tools || null,
    body.timezone ? `Timezone: ${body.timezone}` : null,
    body.notes ? `Notes: ${body.notes}` : null,
  ].filter(Boolean).join(' — ');

  const nameParts = (body.name || '').trim().split(/\s+/).filter(Boolean);
  const firstname = nameParts[0] || '';
  const lastname = nameParts.slice(1).join(' ');

  const properties = {
    email,
    firstname,
    lastname,
    phone: body.phone || '',
    company: body.company || '',
    business_type: body.business || '',
    tai_offer: body.offer || '',
    tools_used: toolsUsed,
  };

  const hubspotHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    const updateRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
      {
        method: 'PATCH',
        headers: hubspotHeaders,
        body: JSON.stringify({ properties }),
      }
    );

    if (updateRes.status === 404) {
      const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: hubspotHeaders,
        body: JSON.stringify({ properties }),
      });
      if (!createRes.ok) {
        const detail = await createRes.text();
        return res.status(502).json({ ok: false, error: 'HubSpot create failed', detail });
      }
    } else if (!updateRes.ok) {
      const detail = await updateRes.text();
      return res.status(502).json({ ok: false, error: 'HubSpot update failed', detail });
    }

    try {
      await sendLeadNotification(body);
    } catch (err) {
      console.error('Lead notification email failed:', err);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: String(err) });
  }
};
