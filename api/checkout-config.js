// Tells the frontend which offers currently accept self-checkout, so the
// site can show a "Pay now" button instead of the booking form. Flip the
// CHECKOUT_*_ENABLED env vars in Vercel (and redeploy) to turn one on.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    audit: true,
    frontdesk: process.env.CHECKOUT_FRONTDESK_ENABLED === 'true',
    setup: process.env.CHECKOUT_SETUP_ENABLED === 'true',
  });
};
