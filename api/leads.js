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
  const email = (body.email || '').trim();
  if (!email) {
    return res.status(400).json({ ok: false, error: 'Email is required' });
  }

  const toolsUsed = body.notes
    ? [body.tools, `Notes: ${body.notes}`].filter(Boolean).join(' — ')
    : body.tools || '';

  const properties = {
    email,
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

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Unexpected error', detail: String(err) });
  }
};
