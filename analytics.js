// Plausible analytics, shared by every Boltin Ben page.
// This is the boltin.io site in Plausible.
(function(){
  var SRC = 'https://plausible.io/js/pa-t-PnqSSR8su9Sm4mDzvVH.js';
  window.plausible = window.plausible || function(){ (plausible.q = plausible.q || []).push(arguments); };
  plausible.init = plausible.init || function(i){ plausible.o = i || {}; };
  plausible.init();
  var s = document.createElement('script'); s.async = true; s.src = SRC; document.head.appendChild(s);

  // Any link or button carrying data-track sends a named event when tapped.
  // data-track="Plan Clicked" data-what="Run Faster" becomes the event and its detail.
  document.addEventListener('click', function(e){
    var el = e.target.closest && e.target.closest('[data-track]');
    if (!el) return;
    try { window.plausible(el.getAttribute('data-track'), { props: { what: el.getAttribute('data-what') || '', page: location.pathname } }); } catch (err) {}
    // the same click, in Meta's words: a buy button or the watch upsell starts a checkout
    var name = el.getAttribute('data-track');
    if (name === 'Add to Cart' || name === 'Upsell Clicked') bbPx('InitiateCheckout', { content_name: el.getAttribute('data-what') || '' });
  });

  // Meta pixel (pixel.js): consent-aware, and it sends PageView itself.
  // bbPx queues an event until the pixel has loaded.
  function bbPx(name, params){ try { (window.bbPixelQ = window.bbPixelQ || []).push([name, params]); } catch (err) {} }
  window.bbPx = bbPx;
  var px = document.createElement('script'); px.async = true; px.src = '/pixel.js'; document.head.appendChild(px);
  var SALES = { '/base-builder': 'The Base Builder Bible', '/run-faster': 'Run Faster in 30 Days' };
  var here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  if (SALES[here]) bbPx('ViewContent', { content_name: SALES[here], content_type: 'product' });
})();
