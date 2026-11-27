// netlify/functions/checkout-session.js
// POST /api/checkout-session  { product }
// Starts a Stripe Checkout that opens on the page itself (embedded), so a
// buyer never leaves boltin.io (Ben, 27 Nov 2026: 33 of 38 people who tapped
// buy left at Stripe's hosted checkout).
//
// The price tier is decided here from the visitor's country (the same list as
// /api/geo), never from anything the page sends. The session carries the same
// metadata as the payment links, so the Sparkies webhook delivers the books
// exactly as before.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   STRIPE_SECRET_KEY        a restricted key that can write Checkout Sessions
//   STRIPE_PUBLISHABLE_KEY   the pk_live_ key, sent to the page for Stripe.js
// If either is missing, or Stripe refuses, the page falls back to the payment link.

const geo = require('./geo');

const SITE = 'https://boltin.io';
const PRODUCTS = {
  'base-builder': {
    prices: { 1: 'price_1UfTFe5D7fRKN8PPRkXkN2I9', 2: 'price_1UfWNW5D7fRKN8PPwuqvEPKN', 3: 'price_1UfWNb5D7fRKN8PPH902lce2' },
    metadata: { product_key: 'plan_base_builder' }, back: '/base-builder/thanks'
  },
  'run-faster': {
    prices: { 1: 'price_1UfonJ5D7fRKN8PPPmhKTCjv', 2: 'price_1UfpOa5D7fRKN8PP4qExxVZk', 3: 'price_1UfpOw5D7fRKN8PP4ltn1Jfp' },
    metadata: { product_key: 'plan_rf30', edition: 'plan' }, back: '/run-faster/thanks'
  }
};

function reply(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false });
  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { ok: false }); }
  const product = PRODUCTS[input.product];
  if (!product) return reply(400, { ok: false, error: 'unknown product' });
  const key = process.env.STRIPE_SECRET_KEY, pk = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key || !pk) { console.error('[checkout] missing', !key ? 'STRIPE_SECRET_KEY' : 'STRIPE_PUBLISHABLE_KEY'); return reply(503, { ok: false, error: 'not configured' }); }

  const tier = geo.tierOf(geo.countryOf(event.headers));
  const meta = Object.assign({}, product.metadata, { tier: String(tier), site: 'boltin', checkout: 'embedded' });
  const form = new URLSearchParams();
  form.set('ui_mode', 'embedded');
  form.set('mode', 'payment');
  form.set('line_items[0][price]', product.prices[tier] || product.prices[1]);
  form.set('line_items[0][quantity]', '1');
  form.set('return_url', SITE + product.back + '?session_id={CHECKOUT_SESSION_ID}');
  Object.keys(meta).forEach(k => { form.set('metadata[' + k + ']', meta[k]); form.set('payment_intent_data[metadata][' + k + ']', meta[k]); });

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.client_secret) {
      console.error('[checkout] Stripe said', res.status, data && data.error && (data.error.code || data.error.message));
      return reply(502, { ok: false, error: 'stripe refused' });
    }
    return reply(200, { ok: true, clientSecret: data.client_secret, pk: pk, tier: tier });
  } catch (e) {
    console.error('[checkout]', e && e.message);
    return reply(502, { ok: false, error: 'stripe unreachable' });
  }
};
