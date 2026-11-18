// netlify/functions/subscribe-status.js
// GET /api/subscribe-status: a quick health check for the sign-up form.
// Says whether the Sender settings are present and whether Sender accepts
// the token and knows the Fuel group. Never shows the token or any email.

const API = 'https://api.sender.net/v2';

function reply(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body, null, 2)
  };
}

exports.handler = async () => {
  const token = process.env.SENDER_API_TOKEN || '';
  const group = process.env.SENDER_GROUP_FUEL || 'aO2oEE';   // same default as _subscribe.js
  const out = {
    SENDER_API_TOKEN: token ? 'set' : 'MISSING: add it in Netlify, then redeploy',
    SENDER_GROUP_FUEL: (process.env.SENDER_GROUP_FUEL ? 'set' : 'using the built-in default') + ' (' + group + ')',
    sender_token: 'not checked',
    fuel_group: 'not checked',
    RESEND_API_KEY: process.env.RESEND_API_KEY ? 'set (contact forms)' : 'MISSING: contact forms cannot send until it is added',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'set (1:1 onboarding saves to Supabase)' : 'MISSING: 1:1 onboarding cannot save to Supabase (Ben is still emailed)'
  };
  if (!token) return reply(out);

  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  try {
    const me = await fetch(API + '/groups?limit=1', { headers });
    out.sender_token = me.ok ? 'accepted by Sender' : 'REJECTED by Sender (' + me.status + '): check the token';
    if (me.ok && group) {
      const g = await fetch(API + '/groups/' + encodeURIComponent(group), { headers });
      let title = '';
      try { const b = await g.json(); title = (b && b.data && b.data.title) || (b && b.title) || ''; } catch (e) {}
      out.fuel_group = g.ok ? 'found' + (title ? ': ' + title : '') : 'NOT FOUND (' + g.status + '): check SENDER_GROUP_FUEL';
    }
  } catch (e) {
    out.sender_token = 'could not reach Sender: ' + (e && e.message);
  }
  return reply(out);
};
