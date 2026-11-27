// pixel.js
// The Meta (Facebook) pixel on boltin.io, loaded by analytics.js on every page
// (Ben, 27 Nov 2026). It is the Sparkies pixel, so both sites share one ads
// account and one audience.
//
// Consent the same way as sparkies.app: visitors in the EU, UK, EEA and
// Switzerland (worked out by /api/geo) see a banner and the pixel only loads
// on OK. Everyone else gets it straight away. A "no" is remembered and Meta's
// code never loads. If the country lookup fails, the banner shows.
//
// Never on the 1:1 onboarding form, which asks about health.
//
// Pages report conversions with bbPixel('Purchase', { value, currency, ... }).
// Events sent before the pixel has loaded wait in a queue.

(function () {
  var PIXEL_ID = '1068773079214572';
  var KEY = 'bb_mkt_consent';   // 'yes' | 'no'
  var loaded = false, pending = [];

  var path = window.location.pathname || '';
  if (/^\/(1on1\/onboarding|one-on-one-onboarding)/.test(path)) { window.bbPixel = function () {}; return; }

  function consent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadPixel() {
    if (loaded) return;
    loaded = true;
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    var q = pending; pending = [];
    q.forEach(function (ev) { window.bbPixel(ev[0], ev[1]); });
  }

  // pages that called bbPixel before this file ran left their events here
  var early = (window.bbPixelQ || []).slice();
  window.bbPixel = function (eventName, params) {
    if (consent() === 'no') return;
    if (!loaded) { pending.push([eventName, params]); return; }
    try { window.fbq('track', eventName, params || undefined); } catch (e) {}
  };
  early.forEach(function (ev) { window.bbPixel(ev[0], ev[1]); });
  window.bbPixelQ = { push: function (ev) { window.bbPixel(ev[0], ev[1]); } };

  function showBanner() {
    var el = document.createElement('div');
    el.id = 'bb-consent';
    el.innerHTML =
      '<style>' +
      '#bb-consent{position:fixed;left:14px;right:14px;bottom:14px;z-index:9999;background:#1e1e1e;border-radius:16px;padding:16px 18px;font-family:Barlow,Arial,sans-serif;color:#e8e8ea;font-size:15px;line-height:1.5;box-shadow:0 12px 40px rgba(0,0,0,.6);max-width:440px;margin:0 auto}' +
      '#bb-consent b{color:#fff}' +
      '#bb-consent .bc-row{display:flex;gap:10px;margin-top:12px}' +
      '#bb-consent button{flex:1;border:0;border-radius:8px;padding:12px 0;font-family:inherit;font-weight:600;font-size:15px;cursor:pointer}' +
      '#bb-consent .bc-yes{background:#F5E215;color:#000}' +
      '#bb-consent .bc-no{background:#2b2b2b;color:#a8a8a8}' +
      '#bb-consent a{color:#a8a8a8}' +
      '</style>' +
      '<b>One marketing cookie?</b> I use the Meta pixel so I can show Boltin Ben ads and see which ones work. No thanks means it never loads. <a href="https://sparkies.app/privacy.html" target="_blank" rel="noopener">Privacy policy</a>' +
      '<div class="bc-row">' +
      '<button type="button" class="bc-no">No thanks</button>' +
      '<button type="button" class="bc-yes">OK</button>' +
      '</div>';
    document.body.appendChild(el);
    el.querySelector('.bc-yes').onclick = function () { setConsent('yes'); el.remove(); loadPixel(); };
    el.querySelector('.bc-no').onclick = function () { setConsent('no'); el.remove(); pending = []; };
  }

  // Countries whose law wants an opt-in before an ad pixel: EEA, UK, Switzerland.
  var CONSENT_COUNTRIES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH'];

  function boot() {
    var c = consent();
    if (c === 'yes') { loadPixel(); return; }
    if (c === 'no') return;
    fetch('/api/geo').then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.country && CONSENT_COUNTRIES.indexOf(d.country) === -1) loadPixel();
      else showBanner();
    }, function () { showBanner(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
