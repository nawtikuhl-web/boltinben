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

Old WordPress addresses (`/rate-card`, `/sponsors`, `/about`, `/contact`,
`/sparkies`, `/find-my-zones`, `/links`) redirect to their new homes; see `_redirects`.

## Common edits

- **Switch a plan option from waitlist to checkout:** paste its Stripe payment
  link into `checkout.js`. An empty link shows "Join the waitlist"; a filled one
  shows "Buy now".
- **Look and feel:** `site.css` for the main pages, `tool.css` for the free tools.
- **Forms:** contact, enquiry and waitlist forms post to Formspree. The endpoint
  is at the top of `site.js`.
- **Analytics:** Plausible, loaded by `analytics.js`. Any link with
  `data-track="Event Name"` and `data-what="detail"` sends a named event.
  The script address currently points at the Sparkies site in Plausible;
  swap it for a boltin.io site when you create one.

## Hosting

Set up for Netlify: connect this repo, leave the build command empty and the
publish directory as the repo root. `netlify.toml` and `_redirects` are picked
up automatically. Then point boltin.io at the Netlify site.
