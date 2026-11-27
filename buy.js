// buy.js
// Checkout on the page itself (Ben, 27 Nov 2026). Tapping a buy button opens a
// sheet with Stripe's embedded checkout in it: Apple Pay, Google Pay or Link at
// the top, a short card form under it, and the buyer never leaves boltin.io.
//
// If anything goes wrong (the function is not set up, Stripe.js is blocked, it
// takes too long), the tap goes to the button's own payment link instead, which
// is how it worked before. So this can only add a way to pay, never remove one.

(function () {
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  var product = { '/base-builder': 'base-builder', '/run-faster': 'run-faster' }[path];
  if (!product || !window.fetch) return;

  var sheet, box, checkout, opening = false, dead = false;

  function track(name, props) { try { window.plausible(name, props ? { props: props } : undefined); } catch (e) {} }

  function build() {
    sheet = document.createElement('div');
    sheet.className = 'bb-pay'; sheet.hidden = true;
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Checkout');
    sheet.innerHTML =
      '<style>' +
      '.bb-pay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;justify-content:center}' +
      '.bb-pay[hidden]{display:none}' +
      '.bb-pay-in{background:#fff;width:100%;max-width:560px;max-height:94vh;max-height:94dvh;border-radius:18px 18px 0 0;overflow:auto;-webkit-overflow-scrolling:touch;padding-bottom:env(safe-area-inset-bottom)}' +
      '.bb-pay-top{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#000;color:#fff;font-family:Barlow,Arial,sans-serif;font-weight:600;font-size:16px}' +
      '.bb-pay-x{background:#2b2b2b;color:#fff;border:0;border-radius:8px;padding:9px 14px;font:inherit;font-size:15px;cursor:pointer}' +
      '.bb-pay-wait{padding:60px 20px;text-align:center;font-family:Barlow,Arial,sans-serif;color:#555;font-size:17px}' +
      '@media (min-width:700px){.bb-pay{align-items:center}.bb-pay-in{border-radius:18px;max-height:90vh}}' +
      '</style>' +
      '<div class="bb-pay-in"><div class="bb-pay-top"><span>Secure checkout</span><button type="button" class="bb-pay-x">Close</button></div>' +
      '<div class="bb-pay-wait" id="bb-pay-wait">Loading secure checkout…</div><div id="bb-pay-box"></div></div>';
    document.body.appendChild(sheet);
    box = sheet.querySelector('#bb-pay-box');
    sheet.querySelector('.bb-pay-x').addEventListener('click', close);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet && !sheet.hidden) close(); });
  }
  function close() {
    if (!sheet) return;
    sheet.hidden = true; document.documentElement.style.overflow = '';
    track('Checkout Closed', { what: product });
  }
  function loadStripe() {
    return new Promise(function (ok, no) {
      if (window.Stripe) return ok();
      var s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.onload = function () { window.Stripe ? ok() : no(new Error('no Stripe')); }; s.onerror = function () { no(new Error('Stripe.js blocked')); };
      document.head.appendChild(s);
    });
  }
  function withTimeout(p, ms) {
    return new Promise(function (ok, no) { var t = setTimeout(function () { no(new Error('timeout')); }, ms); p.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); no(e); }); });
  }

  function open(fallback) {
    if (opening) return;
    opening = true;
    if (!sheet) build();
    // a checkout already started on this page is still there: just show it again
    if (checkout) { sheet.hidden = false; document.documentElement.style.overflow = 'hidden'; opening = false; track('Checkout Opened', { what: product, again: 'yes' }); return; }
    sheet.hidden = false; document.documentElement.style.overflow = 'hidden';
    var session = fetch('/api/checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product: product }) })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok || !b.ok) throw new Error(b.error || 'no session'); return b; }); });
    withTimeout(Promise.all([session, loadStripe()]), 8000).then(function (got) {
      var s = got[0];
      return window.Stripe(s.pk).initEmbeddedCheckout({ fetchClientSecret: function () { return Promise.resolve(s.clientSecret); } });
    }).then(function (c) {
      checkout = c; c.mount(box);
      var w = document.getElementById('bb-pay-wait'); if (w) w.remove();
      opening = false;
      track('Checkout Opened', { what: product });
    }).catch(function (err) {
      // the old way still works: send them to the payment link
      dead = true; opening = false;
      track('Checkout Fallback', { what: product, why: String(err && err.message || err).slice(0, 60) });
      location.href = fallback;
    });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-checkout]');
    if (!a || dead) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;   // let people open it in a new tab
    e.preventDefault();
    open(a.href);
  });
})();
