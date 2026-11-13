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
  });
})();
