// netlify/functions/onboarding.js
// POST /api/onboarding: the 1:1 coaching onboarding form at /1on1/onboarding.
//   1. Saves the answers to the Supabase table coaching_onboarding (status "new").
//   2. Emails Ben a summary: "Onboarding: {name} ({start})".
//   3. Emails the client a short confirmation from Ben.
// The submission counts as received if it was saved or Ben was emailed, so a
// client is never told to try again when Ben already has their answers.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   SUPABASE_SERVICE_KEY   the Sparkies Supabase service role key (secret)
//   SUPABASE_URL           optional; defaults to the Sparkies project
//   RESEND_API_KEY         as for the contact forms
//   CONTACT_TO             optional; where the summary goes (default ben@sparkies.app)
//
// House rule: no em dashes.

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://ysbufbmeamjujrqfgsam.supabase.co').replace(/\/+$/, '');
const TO = process.env.CONTACT_TO || 'ben@sparkies.app';
const FROM_SITE = 'Boltin Ben website <hello@sparkies.app>';
const FROM_BEN = 'Ben Williams <hello@sparkies.app>';
const REPLY_BEN = 'ben@sparkies.app';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const OTHER = ['strength', 'cycling', 'swimming', 'team sports'];

function reply(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function text(v, n) { const s = String(v == null ? '' : v).trim().slice(0, n || 500); return s || null; }
function num(v, lo, hi) { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null; }
function oneOf(v, list) { const s = String(v == null ? '' : v).trim().toLowerCase(); return list.includes(s) ? s : null; }

// Clean the posted answers into one row for coaching_onboarding.
function toRow(i) {
  const raceDate = /^\d{4}-\d{2}-\d{2}$/.test(String(i.race_date || '')) ? i.race_date : null;
  const days = (Array.isArray(i.run_days) ? i.run_days : []).filter(d => DAYS.includes(d));
  const other = {};
  OTHER.forEach(k => { const n = parseInt((i.other_training || {})[k], 10); if (n > 0 && n <= 14) other[k] = n; });
  const ageN = parseInt(i.age, 10);
  return {
    name: text(i.name, 100), email: (text(i.email, 200) || '').toLowerCase(), instagram: text(i.instagram, 60),
    age: ageN >= 10 && ageN <= 100 ? ageN : null, location: text(i.location, 120), timezone: text(i.timezone, 60),
    goal: text(i.goal, 60), race_name: text(i.race_name, 120), race_date: raceDate, goal_time: text(i.goal_time, 40),
    weekly_km: num(i.weekly_km, 0, 400), longest_run_km: num(i.longest_run_km, 0, 200), easy_pace: text(i.easy_pace, 20),
    recent_results: text(i.recent_results, 2000),
    run_days: days, time_of_day: text(i.time_of_day, 40), weekday_max: text(i.weekday_max, 40), weekend_max: text(i.weekend_max, 40),
    schedule_notes: text(i.schedule_notes, 2000),
    injuries_current: text(i.injuries_current, 2000), injuries_past: text(i.injuries_past, 2000), medical: text(i.medical, 2000),
    fit_to_train: i.fit_to_train === true || i.fit_to_train === 'true' || i.fit_to_train === 'on',
    other_training: other,
    watch: text(i.watch, 80), trainingpeaks: oneOf(i.trainingpeaks, ['yes', 'no', 'not sure']),
    feedback_style: text(i.feedback_style, 60), checkin_freq: text(i.checkin_freq, 60),
    start_when: oneOf(i.start_when, ['now', 'later']), start_month: text(i.start_month, 20),
    extra: text(i.extra, 3000), source: text(i.source, 200)
  };
}

function startLabel(r) {
  if (r.start_when === 'later') return 'held spot' + (r.start_month ? ': ' + r.start_month : '');
  return 'start now';
}

// The summary for Ben, section by section, skipping anything left blank.
function summary(r) {
  const other = Object.keys(r.other_training).map(k => k + ' ' + r.other_training[k] + ' a week').join(', ');
  return [
    ['About', [['Name', r.name], ['Email', r.email], ['Instagram', r.instagram], ['Age', r.age], ['Location', r.location], ['Time zone', r.timezone]]],
    ['Goals', [['Main goal', r.goal], ['Race', r.race_name], ['Race date', r.race_date], ['Goal time', r.goal_time]]],
    ['Running now', [['Weekly km', r.weekly_km], ['Longest run, last month (km)', r.longest_run_km], ['Easy pace (min/km)', r.easy_pace], ['Recent results', r.recent_results]]],
    ['Schedule', [['Days', r.run_days.join(', ')], ['Time of day', r.time_of_day], ['Weekday max', r.weekday_max], ['Weekend max', r.weekend_max], ['Notes', r.schedule_notes]]],
    ['Health', [['Current injuries or niggles', r.injuries_current], ['Past injuries', r.injuries_past], ['Medical', r.medical], ['Fit to train or cleared', r.fit_to_train ? 'Yes' : 'NOT CONFIRMED']]],
    ['Other training', [['Each week', other || 'None']]],
    ['Tech', [['Watch', r.watch], ['TrainingPeaks', r.trainingpeaks]]],
    ['Coaching style', [['Feedback', r.feedback_style], ['Check-ins', r.checkin_freq]]],
    ['Start', [['When', startLabel(r)]]],
    ['Anything else', [['', r.extra]]]
  ].map(([title, rows]) => [title, rows.filter(([, v]) => v !== null && v !== '' && v !== undefined)]).filter(([, rows]) => rows.length);
}

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

async function save(r) {
  if (!process.env.SUPABASE_SERVICE_KEY) return { ok: false, reason: 'SUPABASE_SERVICE_KEY is not set' };
  const key = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(SUPABASE_URL + '/rest/v1/coaching_onboarding', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(r)
  });
  if (res.ok) return { ok: true };
  let d = ''; try { d = (await res.text()).slice(0, 300); } catch (e) {}
  return { ok: false, reason: 'Supabase said ' + res.status + ' ' + d };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Use POST.' });
  let input;
  try { input = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { ok: false, error: 'That did not come through. Try again.' }); }
  if (input.website) return reply(200, { ok: true });   // honeypot

  const r = toRow(input);
  if (!r.name) return reply(400, { ok: false, error: 'Add your name.' });
  if (!EMAIL.test(r.email)) return reply(400, { ok: false, error: 'That email does not look right.' });
  if (!r.fit_to_train) return reply(400, { ok: false, error: 'Tick the box to confirm you are fit to train or have medical clearance.' });

  const first = r.name.split(/\s+/)[0];
  const sections = summary(r);
  const html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">' +
    '<p style="margin:0 0 14px"><strong>New 1:1 onboarding</strong> from boltin.io/1on1/onboarding. Hit Reply to answer ' + esc(first) + ' directly. It is also in the admin, Coaching tab.</p>' +
    sections.map(([title, rows]) => '<h3 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:18px 0 6px">' + esc(title) + '</h3>' +
      '<table style="border-collapse:collapse">' + rows.map(([k, v]) =>
        '<tr>' + (k ? '<td style="padding:4px 14px 4px 0;color:#666;vertical-align:top;white-space:nowrap">' + esc(k) + '</td>' : '') +
        '<td style="padding:4px 0;white-space:pre-wrap">' + esc(v) + '</td></tr>').join('') + '</table>').join('') + '</div>';
  const plain = 'New 1:1 onboarding\n\n' + sections.map(([title, rows]) => title.toUpperCase() + '\n' + rows.map(([k, v]) => (k ? k + ': ' : '') + v).join('\n')).join('\n\n');

  let saved = { ok: false, reason: 'not tried' }, toBen = { ok: false, reason: 'not tried' }, toClient = { ok: false, reason: 'not tried' };
  try { saved = await save(Object.assign({ status: 'new' }, r)); } catch (e) { saved = { ok: false, reason: e && e.message }; }
  try {
    toBen = await resend({ from: FROM_SITE, to: [TO], reply_to: r.email, subject: 'Onboarding: ' + r.name + ' (' + startLabel(r) + ')', html, text: plain });
  } catch (e) { toBen = { ok: false, reason: e && e.message }; }

  if (!saved.ok) console.error('[onboarding] save:', saved.reason);
  if (!toBen.ok) console.error('[onboarding] email to Ben:', toBen.reason);
  if (!saved.ok && !toBen.ok) return reply(502, { ok: false, error: 'Something went wrong on our side. Try again in a minute, or email ben@sparkies.app.' });

  try {
    const line = "Thanks " + first + ", I've got everything. I'll be in touch within 48 hours with your plan and next steps.";
    toClient = await resend({
      from: FROM_BEN, to: [r.email], reply_to: REPLY_BEN, subject: "Got it, " + first + ". Your 1:1 coaching starts here",
      html: '<div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#111"><p>' + esc(line) + '</p><p>Ben</p></div>',
      text: line + '\n\nBen'
    });
  } catch (e) { toClient = { ok: false, reason: e && e.message }; }
  if (!toClient.ok) console.error('[onboarding] email to client:', toClient.reason);

  return reply(200, { ok: true });
};
