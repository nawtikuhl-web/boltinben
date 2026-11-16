// netlify/functions/apply.js
// POST /api/apply: the 1:1 coaching application on /1on1.
// 1. Emails Ben every answer through Resend, with the applicant as reply-to.
// 2. Adds them to a Sender group so Ben can email everyone who applied when
//    spots open (only when that group is configured).
// The application counts as received if either step works.
//
// Environment variables:
//   RESEND_API_KEY          as for the contact forms
//   CONTACT_TO              optional; where applications go (default ben@sparkies.app)
//   SENDER_API_TOKEN        as for the FUEL sign-up
//   SENDER_GROUP_COACHING   optional; the "Coaching interest" group id in Sender

const { subscribe } = require('./_subscribe');

const TO = process.env.CONTACT_TO || 'ben@sparkies.app';
const FROM = process.env.CONTACT_FROM || 'Boltin Ben website <hello@sparkies.app>';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const QUESTIONS = [
  ['firstName', 'First name'], ['email', 'Email'], ['instagram', 'Instagram'],
  ['goal', 'Main goal'], ['race', 'Race and date'], ['weekly', 'Running now'],
  ['start', 'Would start'], ['price', '$249 a month'], ['extra', 'Anything else'], ['source', 'Came from']
];

function reply(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function clip(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }

async function emailBen(a) {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'RESEND_API_KEY is not set' };
  const hot = /^yes/i.test(a.price) && /now|month/i.test(a.start);
  const subject = (hot ? 'Hot lead: ' : '') + '1:1 coaching application from ' + a.firstName + ' (' + (a.start || 'start not given') + ', ' + (a.price || 'price not given') + ')';
  const rows = QUESTIONS.filter(([k]) => a[k]).map(([k, label]) =>
    '<tr><td style="padding:6px 14px 6px 0;color:#666;vertical-align:top;white-space:nowrap">' + label + '</td>' +
    '<td style="padding:6px 0;white-space:pre-wrap">' + esc(a[k]) + '</td></tr>').join('');
  const html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">' +
    '<p style="margin:0 0 12px"><strong>New 1:1 coaching application</strong> from boltin.io/1on1. Hit Reply to answer ' + esc(a.firstName) + ' directly.</p>' +
    '<table style="border-collapse:collapse">' + rows + '</table></div>';
  const text = 'New 1:1 coaching application\n\n' + QUESTIONS.filter(([k]) => a[k]).map(([k, label]) => label + ': ' + a[k]).join('\n');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: a.email, subject, html, text })
  });
  if (res.ok) return { ok: true };
  let detail = ''; try { detail = JSON.stringify(await res.json()).slice(0, 200); } catch (e) {}
  return { ok: false, reason: 'Resend said ' + res.status + ' ' + detail };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Use POST.' });
  let input = {};
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { ok: false, error: 'That did not come through. Try again.' }); }
  if (input.website) return reply(200, { ok: true });   // honeypot

  const a = {
    firstName: clip(input.firstName, 60), email: clip(input.email, 200).toLowerCase(), instagram: clip(input.instagram, 60),
    goal: clip(input.goal, 80), race: clip(input.race, 160), weekly: clip(input.weekly, 40),
    start: clip(input.start, 60), price: clip(input.price, 60), extra: clip(input.extra, 3000), source: clip(input.source, 200)
  };
  if (!a.firstName) return reply(400, { ok: false, error: 'Add your first name.' });
  if (!EMAIL.test(a.email)) return reply(400, { ok: false, error: 'That email does not look right. Check it and try again.' });

  let mailed = { ok: false, reason: 'not tried' }, listed = { ok: false, reason: 'no Sender group set for coaching' };
  try { mailed = await emailBen(a); } catch (e) { mailed = { ok: false, reason: e && e.message }; }
  if (process.env.SENDER_GROUP_COACHING) {
    try { listed = await subscribe(a.email, a.firstName, 'coaching'); } catch (e) { listed = { ok: false, reason: e && e.message }; }
  }
  if (!mailed.ok) console.error('[apply] email:', mailed.reason);
  if (!listed.ok && process.env.SENDER_GROUP_COACHING) console.error('[apply] sender:', listed.reason);
  if (mailed.ok || listed.ok) return reply(200, { ok: true });
  return reply(502, { ok: false, error: 'Something went wrong on our side. Try again in a minute.' });
};
