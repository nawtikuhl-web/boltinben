(function(){
  var FORM_ENDPOINT = '/api/contact';   // netlify/functions/contact.js, emails Ben through Resend
  var form = document.getElementById('enquiry');
  var topic = document.getElementById('f-topic');
  var status = document.getElementById('f-status');
  var send = document.getElementById('f-send');
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  // Plan pages: a buy button goes to Stripe when checkout.js has a link for it,
  // otherwise it stays a waitlist button that preselects its option in the form.
  var links = window.BB_CHECKOUT || {}, live = 0, buys = document.querySelectorAll('a[data-buy]');
  buys.forEach(function(a){
    var url = (links[a.getAttribute('data-plan')] || {})[a.getAttribute('data-buy')];
    if (!url) return;
    live++;
    a.href = url;
    a.removeAttribute('data-topic');
    a.setAttribute('data-track', 'Add to Cart');
    a.setAttribute('data-what', a.getAttribute('data-name') + ' · ' + a.getAttribute('data-buy'));
    a.firstChild.nodeValue = 'Buy now ';
  });
  var wl = document.getElementById('waitlist');
  if (wl && buys.length && live === buys.length) wl.hidden = true;
  if (!form) return;

  // Buttons around the page preselect what the enquiry is about.
  document.querySelectorAll('a[data-topic]').forEach(function(a){
    a.addEventListener('click', function(){
      var want = a.getAttribute('data-topic');
      for (var i = 0; i < topic.options.length; i++) {
        if (topic.options[i].text === want) { topic.selectedIndex = i; break; }
      }
    });
  });

  function say(text, kind){ status.textContent = text; status.className = 'form-msg' + (kind ? ' ' + kind : ''); }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var data = new FormData(form);
    if (data.get('_gotcha')) return;
    var email = String(data.get('email') || '').trim();
    if (!String(data.get('name') || '').trim() || !/^\S+@\S+\.\S+$/.test(email) || (form.querySelector('[name=message][required]') && !String(data.get('message') || '').trim())) {
      say('Add your name, a working email and a quick message, then send it again.', 'bad');
      return;
    }
    send.disabled = true;
    say('Sending…');
    var payload = {}; data.forEach(function(v, k){ payload[k] = v; });
    payload.page = location.pathname;
    fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
      .then(function(res){ return res.json().catch(function(){ return {}; }).then(function(b){ if (!res.ok || !b.ok) throw new Error('bad status'); }); })
      .then(function(){
        try { window.plausible('Enquiry Sent', { props: { what: topic.value, page: location.pathname } }); } catch (err) {}
        form.reset();
        say("Got it. I'll be in touch within 2 business days.", 'ok');
      })
      .catch(function(){
        say("That didn't send. Email me at ben@sparkies.app instead.", 'bad');
      })
      .then(function(){ send.disabled = false; });
  });
})();
