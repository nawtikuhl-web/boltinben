// netlify/functions/contact.js
// POST /api/contact: every form on the site (coaching contact, brand
// enquiry, plan waitlists) emails Ben through Resend. Reply-to is the
// person who filled it in, so hitting Reply answers them directly.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   RESEND_API_KEY   Resend > API Keys (the Sparkies key works: sparkies.app is verified there)
//   CONTACT_TO       optional; where enquiries go (default ben@sparkies.app)
//   CONTACT_FROM     optional; the sender (default "Boltin Ben website <hello@sparkies.app>")

const TO = process.env.CONTACT_TO || 'ben@sparkies.app';
const FROM = process.env.CONTACT_FROM || 'Boltin Ben website <hello@sparkies.app>';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The fields the forms send, in the order they read best in the email.
const FIELDS = [
  ['name', 'Name'], ['email', 'Email'], ['brand', 'Brand'],
  ['plan', 'Plan'], ['interested_in', 'After'], ['message', 'Message'], ['page', 'Sent from']
];

function reply(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function clip(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Use POST.' });

  let input = {};
  try {
    const type = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    input = type.includes('application/json') ? JSON.parse(event.body || '{}') : Object.fromEntries(new URLSearchParams(event.body || ''));
  } catch (e) {
    return reply(400, { ok: false, error: 'That did not come through. Try again.' });
  }
  if (input._gotcha) return reply(200, { ok: true });            // honeypot

  const f = {
    name: clip(input.name, 100), email: clip(input.email, 200).toLowerCase(), brand: clip(input.brand, 120),
    plan: clip(input.plan, 120), interested_in: clip(input.interested_in, 160), message: clip(input.message, 5000),
    page: clip(input.page, 200)
  };
  if (!f.name || !EMAIL.test(f.email)) return reply(400, { ok: false, error: 'Add your name and a working email, then send it again.' });

  if (!process.env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY is not set');
    return reply(502, { ok: false, error: 'Something went wrong on our side.' });
  }

  const kind = f.plan ? 'Waitlist' : f.brand || /sponsor|post|retainer|monthly|partnership/i.test(f.interested_in) ? 'Brand enquiry' : 'Enquiry';
  const about = f.plan ? f.plan + (f.interested_in ? ' · ' + f.interested_in : '') : f.interested_in || 'general';
  const subject = kind + ': ' + about + ' (' + f.name + ')';

  const rows = FIELDS.filter(([k]) => f[k]).map(([k, label]) =>
    '<tr><td style="padding:6px 14px 6px 0;color:#666;vertical-align:top;white-space:nowrap">' + label + '</td>' +
    '<td style="padding:6px 0;white-space:pre-wrap">' + esc(f[k]) + '</td></tr>').join('');
  const html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">' +
    '<p style="margin:0 0 12px"><strong>' + esc(kind) + '</strong> from boltin.io. Hit Reply to answer ' + esc(f.name.split(' ')[0]) + ' directly.</p>' +
    '<table style="border-collapse:collapse">' + rows + '</table></div>';
  const text = kind + ' from boltin.io\n\n' + FIELDS.filter(([k]) => f[k]).map(([k, label]) => label + ': ' + f[k]).join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: f.email, subject, html, text })
    });
    if (res.ok) return reply(200, { ok: true });
    let detail = ''; try { detail = JSON.stringify(await res.json()).slice(0, 300); } catch (e) {}
    console.error('[contact] Resend said', res.status, detail);
  } catch (e) {
    console.error('[contact]', e && e.message);
  }
  return reply(502, { ok: false, error: 'Something went wrong on our side.' });
};
