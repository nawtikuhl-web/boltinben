// netlify/functions/watch-setup.js
// POST /api/watch-setup: the TrainingPeaks set-up form at /base-builder/watch,
// where buyers of the Base Builder watch version (US$29) land after paying.
// Emails Ben what he needs to load the plan, and emails the buyer a short
// confirmation. Ben checks the payment against the Stripe sale email.
//
// Environment variables: RESEND_API_KEY, CONTACT_TO (optional).
// House rule: no em dashes.

const TO = process.env.CONTACT_TO || 'ben@sparkies.app';
const FROM_SITE = 'Boltin Ben website <hello@sparkies.app>';
const FROM_BEN = 'Ben Williams <hello@sparkies.app>';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STARTS = ['Start 1: From zero', 'Start 2: Getting going', 'Start 3: Build the engine'];
const WATCHES = ['Garmin', 'Apple Watch', 'COROS', 'Suunto', 'Polar', 'Wahoo', 'Other'];

function reply(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function clip(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }

async function resend(payload) {
  if (!process.env.RESEND_API_KEY) return { ok: false, reason: 'RESEND_API_KEY is not set' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.ok) return { ok: true };
  let d = ''; try { d = JSON.stringify(await res.json()).slice(0, 200); } catch (e) {}
  return { ok: false, reason: 'Resend said ' + res.status + ' ' + d };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Use POST.' });
  let i = {};
  try { i = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { ok: false, error: 'That did not come through. Try again.' }); }
  if (i.website) return reply(200, { ok: true });   // honeypot

  const a = {
    name: clip(i.name, 100), email: clip(i.email, 200).toLowerCase(), tpEmail: clip(i.tp_email, 200).toLowerCase(),
    start: STARTS.includes(i.start) ? i.start : '', watch: WATCHES.includes(i.watch) ? i.watch : '',
    day1: /^\d{4}-\d{2}-\d{2}$/.test(String(i.day1 || '')) ? i.day1 : '',
    attached: i.attached === true || i.attached === 'on' || i.attached === 'true',
    notes: clip(i.notes, 2000), paid: i.paid === true || i.paid === '1'
  };
  if (!a.name) return reply(400, { ok: false, error: 'Add your name.' });
  if (!EMAIL.test(a.email)) return reply(400, { ok: false, error: 'That email does not look right.' });
  if (!EMAIL.test(a.tpEmail)) return reply(400, { ok: false, error: 'Add the email on your TrainingPeaks account.' });
  if (!a.start) return reply(400, { ok: false, error: 'Pick your starting point.' });
  if (!a.watch) return reply(400, { ok: false, error: 'Pick your watch.' });
  if (!a.day1) return reply(400, { ok: false, error: 'Pick the day you want to start.' });

  const rows = [['Name', a.name], ['Email used at checkout', a.email], ['TrainingPeaks email', a.tpEmail], ['Plan', a.start],
    ['Watch', a.watch], ['Day 1', a.day1], ['Added Ben as coach', a.attached ? 'Yes' : 'Not yet'],
    ['Came straight from checkout', a.paid ? 'Yes' : 'No, check Stripe for the payment'], ['Notes', a.notes]].filter(r => r[1]);
  const html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">' +
    '<p style="margin:0 0 12px"><strong>Base Builder watch version</strong>: load the plan in TrainingPeaks. Hit Reply to answer ' + esc(a.name.split(/\s+/)[0]) + '.</p>' +
    '<table style="border-collapse:collapse">' + rows.map(([k, v]) => '<tr><td style="padding:5px 14px 5px 0;color:#666;vertical-align:top;white-space:nowrap">' + esc(k) + '</td><td style="padding:5px 0;white-space:pre-wrap">' + esc(v) + '</td></tr>').join('') + '</table></div>';
  let toBen = { ok: false, reason: 'not tried' };
  try {
    toBen = await resend({ from: FROM_SITE, to: [TO], reply_to: a.email, subject: 'Watch setup: ' + a.name + ' (' + a.start + ', day 1 ' + a.day1 + ')', html, text: rows.map(r => r[0] + ': ' + r[1]).join('\n') });
  } catch (e) { toBen = { ok: false, reason: e && e.message }; }
  if (!toBen.ok) {
    console.error('[watch-setup] email to Ben:', toBen.reason);
    return reply(502, { ok: false, error: 'Something went wrong on our side. Try again in a minute, or email ben@sparkies.app.' });
  }
  try {
    const first = a.name.split(/\s+/)[0];
    const line = 'Thanks ' + first + ", I've got your details. I'll load " + a.start + ' into your TrainingPeaks within 48 hours, starting ' + a.day1 + '. If you have not added me as your coach in TrainingPeaks yet, do that first or I cannot see your account.';
    await resend({ from: FROM_BEN, to: [a.email], reply_to: 'ben@sparkies.app', subject: 'Got it, ' + first + '. Your watch plan is on its way',
      html: '<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#111"><p>' + esc(line) + '</p><p>Ben</p></div>', text: line + '\n\nBen' });
  } catch (e) { console.error('[watch-setup] email to buyer:', e && e.message); }
  return reply(200, { ok: true });
};
