// netlify/functions/geo.js
// GET /api/geo: which price tier this visitor's country gets (Ben, 25 Nov
// 2026). Netlify works the country out from the visitor's IP and passes it
// in the request headers; nothing is stored. The Base Builder page uses the
// answer to show the local price and send the buy buttons to that tier's
// Stripe link (checkout.js). Unknown or unlisted countries get tier 1, the
// full price.
//
// To move a country, add or remove its two-letter code below.
const TIERS = {
  // about 40% off
  2: ['BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'UY', 'CR', 'ZA', 'MY', 'TH', 'TR', 'RO', 'BG', 'RS', 'UA'],
  // about 60% off
  3: ['IN', 'ID', 'PH', 'VN', 'NG', 'KE', 'GH', 'EG', 'PK', 'BD', 'LK', 'NP', 'MA', 'TZ', 'UG', 'ET']
};

function countryOf(headers) {
  const h = headers || {};
  let code = h['x-country'] || h['X-Country'] || '';
  if (!code && h['x-nf-geo']) {
    try { const g = JSON.parse(Buffer.from(h['x-nf-geo'], 'base64').toString('utf8')); code = (g && g.country && g.country.code) || ''; } catch (e) {}
  }
  code = String(code).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : '';
}
function tierOf(code) {
  if (TIERS[3].includes(code)) return 3;
  if (TIERS[2].includes(code)) return 2;
  return 1;
}

exports.handler = async (event) => {
  const country = countryOf(event.headers);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Vary': 'x-country' },
    body: JSON.stringify({ country: country, tier: tierOf(country) })
  };
};
exports.tierOf = tierOf;
