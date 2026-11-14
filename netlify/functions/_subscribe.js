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
//   SENDER_GROUP_FUEL       optional; defaults to the "Fuel" group (aO2oEE)
//   SENDER_GROUP_<TAG>      one per extra tag, upper case, e.g. SENDER_GROUP_FUEL_STAN

const API = 'https://api.sender.net/v2';

// Group ids are not secret, so the known ones live here as defaults; an
// environment variable of the same name still wins if it is set.
const DEFAULT_GROUPS = { SENDER_GROUP_FUEL: 'aO2oEE' };   // the "Fuel" group

function groupFor(tag) {
  const key = 'SENDER_GROUP_' + String(tag || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  return process.env[key] || DEFAULT_GROUPS[key] || '';
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

// The group ids a subscriber is already in. Sender has called groups both
// "groups" and "subscriber_tags" in its responses, so read either.
function groupIds(record) {
  const r = (record && (record.data || record)) || {};
  const list = r.groups || r.subscriber_tags || r.tags;
  return Array.isArray(list) ? list.map(g => (g && (g.id || g.tag_id)) || g).filter(Boolean).map(String) : null;
}

function brief(r) { return r.status + ' ' + JSON.stringify(r.data || {}).slice(0, 160); }

// Returns { ok: true } or { ok: false, reason } where reason is safe to log.
async function subscribe(email, firstName, tag) {
  if (!process.env.SENDER_API_TOKEN) return { ok: false, reason: 'SENDER_API_TOKEN is not set' };
  const group = groupFor(tag);
  if (!group) return { ok: false, reason: 'no Sender group id set for tag "' + tag + '"' };

  // 1. A new subscriber: create them in the group and start the automation.
  const created = await call('POST', '/subscribers', {
    email,
    firstname: firstName || undefined,
    groups: [group],
    trigger_automation: true
  });
  if (created.ok) return { ok: true };

  // 2. Already on the list (for example from a manual upload). Read the groups
  // they are in, then save them back with this one added, so nobody is dropped
  // from Stan Leads or anything else. Their existing name is left alone.
  const enc = encodeURIComponent(email);
  const found = await call('GET', '/subscribers/' + enc);
  const current = found.ok ? groupIds(found.data) : null;
  if (current) {
    if (current.includes(group)) return { ok: true };
    const rec = (found.data && (found.data.data || found.data)) || {};
    const patch = { groups: current.concat(group), trigger_automation: true };
    if (firstName && !rec.firstname) patch.firstname = firstName;
    const updated = await call('PATCH', '/subscribers/' + enc, patch);
    if (updated.ok) return { ok: true };
    return { ok: false, reason: 'create ' + brief(created) + ' | update ' + brief(updated) };
  }

  // 3. Could not read their groups: fall back to Sender's add-to-group call,
  // which never touches their other groups.
  const added = await call('POST', '/subscribers/groups/' + encodeURIComponent(group), {
    subscribers: [email],
    trigger_automation: true
  });
  if (added.ok) return { ok: true };
  return { ok: false, reason: 'create ' + brief(created) + ' | lookup ' + brief(found) + ' | add to group ' + brief(added) };
}

module.exports = { subscribe };
