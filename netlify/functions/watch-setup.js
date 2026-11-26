// netlify/functions/watch-setup.js
// POST /api/watch-setup: the TrainingPeaks set-up form at /base-builder/watch,
// where buyers of the Base Builder watch version (US$29) land after paying.
// Ben shares all three plans to the buyer's TrainingPeaks account (26 Nov
// 2026: no coach link, no start date; the plans are theirs to keep). This
// emails Ben the TrainingPeaks email to share to, and the buyer a short
// confirmation. Ben checks the payment against the Stripe sale email.
//
// Environment variables: RESEND_API_KEY, CONTACT_TO (optional).
// House rule: no em dashes.

const TO = process.env.CONTACT_TO || 'ben@sparkies.app';
const FROM_SITE = 'Boltin Ben website <hello@sparkies.app>';
const FROM_BEN = 'Ben Williams <hello@sparkies.app>';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// What each product's buyer is owed. The form says which with "product".
const PRODUCTS = {
  'base-builder': { label: 'Base Builder watch version', share: 'all three Base Builder plans', toBen: 'share all three plans', keep: 'They are yours to keep: pick your starting point, apply it to any start date, and your workouts sync to your watch.', subject: 'Your watch plans are on their way' },
  'run-faster': { label: 'Run Faster watch version', share: 'the Run Faster in 30 Days plan', toBen: 'share the Run Faster plan', keep: 'It is yours to keep: apply it to any start date, and your workouts sync to your watch.', subject: 'Your watch plan is on its way' }
};

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
    product: PRODUCTS[i.product] ? i.product : 'base-builder',
    notes: clip(i.notes, 2000), paid: i.paid === true || i.paid === '1'
  };
  if (!a.name) return reply(400, { ok: false, error: 'Add your name.' });
  if (!EMAIL.test(a.email)) return reply(400, { ok: false, error: 'That email does not look right.' });
  if (!EMAIL.test(a.tpEmail)) return reply(400, { ok: false, error: 'Add the email on your TrainingPeaks account.' });

  const P = PRODUCTS[a.product];
  const rows = [['Product', P.label], ['Name', a.name], ['Email used at checkout', a.email], ['TrainingPeaks email (share the plans here)', a.tpEmail],
    ['Came straight from checkout', a.paid ? 'Yes' : 'No, check Stripe for the payment'], ['Notes', a.notes]].filter(r => r[1]);
  const html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">' +
    '<p style="margin:0 0 12px"><strong>' + P.label + '</strong>: ' + P.toBen + ' to the TrainingPeaks email below. Hit Reply to answer ' + esc(a.name.split(/\s+/)[0]) + '.</p>' +
    '<table style="border-collapse:collapse">' + rows.map(([k, v]) => '<tr><td style="padding:5px 14px 5px 0;color:#666;vertical-align:top;white-space:nowrap">' + esc(k) + '</td><td style="padding:5px 0;white-space:pre-wrap">' + esc(v) + '</td></tr>').join('') + '</table></div>';
  let toBen = { ok: false, reason: 'not tried' };
  try {
    toBen = await resend({ from: FROM_SITE, to: [TO], reply_to: a.email, subject: 'Watch setup: ' + P.toBen + ' to ' + a.tpEmail + ' (' + a.name + ')', html, text: rows.map(r => r[0] + ': ' + r[1]).join('\n') });
  } catch (e) { toBen = { ok: false, reason: e && e.message }; }
  if (!toBen.ok) {
    console.error('[watch-setup] email to Ben:', toBen.reason);
    return reply(502, { ok: false, error: 'Something went wrong on our side. Try again in a minute, or email ben@sparkies.app.' });
  }
  try {
    const first = a.name.split(/\s+/)[0];
    const line = 'Thanks ' + first + ", I've got your details. I'll share " + P.share + ' to your TrainingPeaks account (' + a.tpEmail + ') within 48 hours. ' + P.keep;
    await resend({ from: FROM_BEN, to: [a.email], reply_to: 'ben@sparkies.app', subject: 'Got it, ' + first + '. ' + P.subject,
      html: '<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#111"><p>' + esc(line) + '</p><p>Ben</p></div>', text: line + '\n\nBen' });
  } catch (e) { console.error('[watch-setup] email to buyer:', e && e.message); }
  return reply(200, { ok: true });
};
