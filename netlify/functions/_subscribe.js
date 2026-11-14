// netlify/functions/_subscribe.js
// subscribe(email, firstName, tag): the only place that knows which email
// provider BoltinBen uses. Everything else (the /fuel form, ManyChat) calls
// this, so switching provider means rewriting this file and nothing else.
//
// Provider: Sender (sender.net). Sender files people into groups rather than
// tags, so each tag maps to a Sender group id held in an environment
// variable. The 5-email FUEL sequence is a Sender automation triggered by
// "subscriber added to group".
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   SENDER_API_TOKEN        Sender > Settings > API access tokens
//   SENDER_GROUP_FUEL       the id of the "fuel" group (Sender > Subscribers > Groups)
//   SENDER_GROUP_<TAG>      one per extra tag, upper case, e.g. SENDER_GROUP_FUEL_STAN

const API = 'https://api.sender.net/v2';

function groupFor(tag) {
  const key = 'SENDER_GROUP_' + String(tag || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return process.env[key] || '';
}

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + process.env.SENDER_API_TOKEN,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  return { ok: res.ok, status: res.status, data };
}

// Returns { ok: true } or { ok: false, reason } where reason is safe to log.
async function subscribe(email, firstName, tag) {
  if (!process.env.SENDER_API_TOKEN) return { ok: false, reason: 'SENDER_API_TOKEN is not set' };
  const group = groupFor(tag);
  if (!group) return { ok: false, reason: 'no Sender group id set for tag "' + tag + '"' };

  // A new subscriber: create them in the group and start the automation.
  const created = await call('POST', '/subscribers', {
    email,
    firstname: firstName || undefined,
    groups: [group],
    trigger_automation: true
  });
  if (created.ok) return { ok: true };

  // Already on the list (for example from a manual upload): add them to the
  // group, which is what the automation listens for, and keep their name fresh.
  const add = await call('POST', '/subscribers/groups/' + encodeURIComponent(group), {
    subscribers: [email],
    trigger_automation: true
  });
  if (add.ok) {
    if (firstName) await call('PATCH', '/subscribers/' + encodeURIComponent(email), { firstname: firstName });
    return { ok: true };
  }
  return { ok: false, reason: 'Sender said ' + created.status + ' then ' + add.status + ': ' + JSON.stringify(add.data || created.data || {}).slice(0, 300) };
}

module.exports = { subscribe };
