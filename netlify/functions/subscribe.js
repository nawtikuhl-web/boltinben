// netlify/functions/subscribe.js
// POST /api/subscribe  { email, firstName, tag, website }
// Used by the /fuel sign-up form, and by ManyChat (External Request action)
// when someone gives their email in the FUEL DM. Responds { ok: true } or
// { ok: false, error } with a message fit to show the person.
//
// "website" is a honeypot: people never fill it, bots do.

const { subscribe } = require('./_subscribe');

const TAGS = ['fuel', 'fuel-stan'];          // the only tags this endpoint will apply
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function reply(code, body) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Use POST.' });

  let input = {};
  const type = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
  try {
    input = type.includes('application/json')
      ? JSON.parse(event.body || '{}')
      : Object.fromEntries(new URLSearchParams(event.body || ''));
  } catch (e) {
    return reply(400, { ok: false, error: 'That did not come through. Try again.' });
  }

  if (input.website) return reply(200, { ok: true });   // honeypot: pretend it worked

  const email = String(input.email || '').trim().toLowerCase().slice(0, 200);
  const firstName = String(input.firstName || input.first_name || '').trim().slice(0, 60);
  const tag = TAGS.includes(input.tag) ? input.tag : 'fuel';

  if (!EMAIL.test(email)) return reply(400, { ok: false, error: 'That email does not look right. Check it and try again.' });

  try {
    const r = await subscribe(email, firstName, tag);
    if (r.ok) return reply(200, { ok: true });
    console.error('[subscribe]', tag, r.reason);
  } catch (e) {
    console.error('[subscribe]', tag, e && e.message);
  }
  return reply(502, { ok: false, error: 'Something went wrong on our side. Try again in a minute.' });
};
