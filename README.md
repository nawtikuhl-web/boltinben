# boltin.io

The Boltin Ben website: a plain static site with no build step. Every file in
this folder is served as-is, so editing a page and pushing is all it takes.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Landing menu: Coaching, Community, Advertise with Ben |
| `/coaching` | Coaching hub, 1:1 coaching, about, contact form |
| `/plans` | Every training plan |
| `/zero-to-runner`, `/run-faster`, `/5k`, `/10k`, `/21k`, `/marathon` | One page per plan, three options each |
| `/community` | Sparkies, the free club (the only place that links to sparkies.app) |
| `/brands` | Advertise with Ben: sponsor kit, rate card, enquiry form |
| `/free` | Free tools list |
| `/bolt-vdot-calc`, `/zone2`, `/find-my-zone-two`, `/scorecard`, `/recovery`, `/macro` | The free tools |
| `/half-marathon-blueprint` | Members-only blueprint (Supabase login) |
| `/fuel` | FUEL lead magnet sign-up (first name, email) |
| `/fuel/guide` | The 100 pre-run fuels, the calculator and the Run Faster bridge (noindex) |

Every address the old WordPress site used still works, with or without a
trailing slash. The free tools keep their exact old paths (`/macro`, `/zone2`,
`/recovery` and so on). Pages that moved (`/rate-card`, `/sponsors`, `/about`,
`/contact`, `/sparkies`, `/find-my-zones`, the `?page_id=` links) redirect to
their new homes, and the old WordPress logo image points at `assets/logo.png`.
It's all in `_redirects`.

Internal links use clean root paths (`/plans`, `/assets/...`), so pages work
at any depth.

## Common edits

- **Switch a plan option from waitlist to checkout:** paste its Stripe payment
  link into `checkout.js`. An empty link shows "Join the waitlist"; a filled one
  shows "Buy now".
- **Look and feel:** `site.css` for the main pages, `tool.css` for the free tools.
- **Forms:** contact, enquiry and waitlist forms post to Formspree. The endpoint
  is at the top of `site.js`.
- **Analytics:** Plausible, loaded by `analytics.js`. Any link with
  `data-track="Event Name"` and `data-what="detail"` sends a named event.
  It reports into the boltin.io site in Plausible.

## Hosting

Set up for Netlify: connect this repo, leave the build command empty and the
publish directory as the repo root. `netlify.toml` and `_redirects` are picked
up automatically. Then point boltin.io at the Netlify site.

## FUEL funnel

- **Sign-ups** go to `POST /api/subscribe` (`netlify/functions/subscribe.js`),
  which adds the person to a Sender group. The provider code is all in
  `netlify/functions/_subscribe.js`; swap that file to change provider.
- **The fuels list** lives in `fuel-data.js`: Ben's four groups of 25 from the
  100 Pre-Run Fuels guide, each fuel with its portion, when to have it, and its
  carbs, protein, fat, fibre and calories.
- **The calculator** on the guide is `/macro` in embed mode (`/macro?embed=1`).
- **Plausible events:** `fuel_signup`, `fuel_guide_view`, `rf30_click`. The Run
  Faster button carries `utm_source=fuel&utm_medium=guide&utm_campaign=fuel`.

To check the setup, open `https://boltin.io/api/subscribe-status`: it says
whether the Sender settings are present and accepted, without showing them.

Environment variables (Netlify > Site configuration > Environment variables):

| Name | Value |
| --- | --- |
| `SENDER_API_TOKEN` | Sender > Settings > API access tokens |
| `SENDER_GROUP_FUEL` | `aO2oEE`, the "Fuel" group in Sender |
| `SENDER_GROUP_FUEL_STAN` | id of the "fuel-stan" group (optional, for the Stan import) |

The email sequence is the Sender automation "FUEL: 100 pre-run fuels sequence",
triggered when someone joins the Fuel group. It skips the two Run Faster emails
for anyone in the "RF30 buyer" group, which the Sparkies purchase webhook fills.

ManyChat can add people too: an External Request action that POSTs JSON
`{"email": "{{email}}", "firstName": "{{first_name}}", "tag": "fuel"}` to
`https://boltin.io/api/subscribe`.
