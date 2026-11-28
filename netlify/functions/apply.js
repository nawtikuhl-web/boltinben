// netlify/functions/apply.js
// POST /api/apply: the 1:1 coaching application on /1on1.
// 1. Emails Ben every answer through Resend, with the applicant as reply-to.
// 2. Adds them to a Sender group so Ben can email everyone who applied when
//    spots open (only when that group is configured).
// 3. Saves a one-line copy on the applicant in Sender (field "Coaching
//    application"), so an application never depends on one inbox.
// The application counts as received if any step works.
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
  ['start', 'Would start'], ['price', '$149 works'], ['extra', 'Anything else'], ['source', 'Came from']
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

// A second copy that does not depend on Ben's inbox (28 Nov 2026: an
// application was accepted by Resend and never showed up in the mailbox).
// The applicant is saved in Sender with a "Coaching application" field holding
// a one-line summary, so every application can be found under the "Coaching
// applicants" segment whatever happens to the email.
const SENDER_API = 'https://api.sender.net/v2';
async function sender(method, path, body) {
  const res = await fetch(SENDER_API + path, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.SENDER_API_TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return { ok: res.ok, status: res.status };
}
async function saveApplicant(a) {
  if (!process.env.SENDER_API_TOKEN) return { ok: false, reason: 'SENDER_API_TOKEN is not set' };
  const when = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const summary = [when, 'goal: ' + (a.goal || '-'), 'race: ' + (a.race || '-'), 'now: ' + (a.weekly || '-'), 'start: ' + (a.start || '-'), '$149: ' + (a.price || '-'), a.instagram ? 'ig: ' + a.instagram : '', a.extra ? 'note: ' + a.extra : '']
    .filter(Boolean).join(' | ').slice(0, 250);
  const fields = { '{$coaching_application}': summary };
  const created = await sender('POST', '/subscribers', { email: a.email, firstname: a.firstName || undefined, fields, trigger_automation: false });
  const updated = await sender('PATCH', '/subscribers/' + encodeURIComponent(a.email), { fields });
  if (created.ok || updated.ok) return { ok: true };
  return { ok: false, reason: 'Sender said ' + created.status + ' / ' + updated.status };
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
  let saved = { ok: false, reason: 'not tried' };
  try { saved = await saveApplicant(a); } catch (e) { saved = { ok: false, reason: e && e.message }; }
  if (!saved.ok) console.error('[apply] backup copy:', saved.reason);
  if (!mailed.ok) console.error('[apply] email:', mailed.reason);
  if (!listed.ok && process.env.SENDER_GROUP_COACHING) console.error('[apply] sender:', listed.reason);
  if (mailed.ok || listed.ok || saved.ok) return reply(200, { ok: true });
  return reply(502, { ok: false, error: 'Something went wrong on our side. Try again in a minute.' });
};
