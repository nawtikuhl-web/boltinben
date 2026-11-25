// netlify/functions/quiz.js
// POST /api/quiz  { firstName, email, plan, culprit, website }
// The email step of the quiz at /quiz. Saves the person in Sender with two
// custom fields, so follow-up emails can match what the quiz told them:
//   quiz_plan     from zero | getting going | build the engine | ready for speed
//   quiz_culprit  pace | the start | walk breaks | consistency | structure | fuel | recovery | none
// They also join the "Quiz" group when SENDER_GROUP_QUIZ is set, which is what
// a Sender automation would trigger on. Without it they are saved with the
// fields and no group.
//
// Environment variables: SENDER_API_TOKEN (as for the FUEL sign-up),
// SENDER_GROUP_QUIZ (optional).
// "website" is a honeypot: people never fill it, bots do.

const API = 'https://api.sender.net/v2';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLANS = ['from zero', 'getting going', 'build the engine', 'ready for speed'];
const CULPRITS = ['pace', 'the start', 'walk breaks', 'consistency', 'structure', 'fuel', 'recovery', 'none'];

function reply(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: 'Bearer ' + process.env.SENDER_API_TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch (e) {}
  return { ok: res.ok, status: res.status, data };
}
function groupIds(record) {
  const r = (record && (record.data || record)) || {};
  const list = r.groups || r.subscriber_tags || r.tags;
  return Array.isArray(list) ? list.map(g => (g && (g.id || g.tag_id)) || g).filter(Boolean).map(String) : [];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Use POST.' });
  let i = {};
  try { i = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { ok: false, error: 'that did not come through. try again.' }); }
  if (i.website) return reply(200, { ok: true });

  const email = String(i.email || '').trim().toLowerCase().slice(0, 200);
  const firstName = String(i.firstName || '').trim().slice(0, 60);
  const plan = PLANS.includes(i.plan) ? i.plan : '';
  const culprit = CULPRITS.includes(i.culprit) ? i.culprit : '';
  if (!EMAIL.test(email)) return reply(400, { ok: false, error: 'that email does not look right. check it and try again.' });
  if (!process.env.SENDER_API_TOKEN) { console.error('[quiz] SENDER_API_TOKEN is not set'); return reply(502, { ok: false, error: 'something went wrong on our side.' }); }

  // Sender takes custom fields keyed by their merge name: {$quiz_plan}.
  const fields = {};
  if (plan) fields['{$quiz_plan}'] = plan;
  if (culprit) fields['{$quiz_culprit}'] = culprit;
  const group = process.env.SENDER_GROUP_QUIZ || '';

  try {
    const created = await call('POST', '/subscribers', {
      email, firstname: firstName || undefined, groups: group ? [group] : undefined, fields, trigger_automation: true
    });
    // Whether Sender made a new person or already had them, set the fields
    // again by update, keeping every group they are already in.
    const enc = encodeURIComponent(email);
    const found = await call('GET', '/subscribers/' + enc);
    if (found.ok) {
      const have = groupIds(found.data);
      const patch = { fields };
      if (group && !have.includes(group)) { patch.groups = have.concat(group); patch.trigger_automation = true; }
      const rec = (found.data && (found.data.data || found.data)) || {};
      if (firstName && !rec.firstname) patch.firstname = firstName;
      const updated = await call('PATCH', '/subscribers/' + enc, patch);
      if (updated.ok || created.ok) return reply(200, { ok: true });
      console.error('[quiz] create', created.status, 'update', updated.status);
    } else if (created.ok) return reply(200, { ok: true });
    else console.error('[quiz] create', created.status, JSON.stringify(created.data || {}).slice(0, 200), 'lookup', found.status);
  } catch (e) { console.error('[quiz]', e && e.message); }
  return reply(502, { ok: false, error: 'something went wrong on our side. you can skip this and still see your result.' });
};
