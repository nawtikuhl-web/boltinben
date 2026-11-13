// Stripe payment links for every plan and option.
// Paste a link between the quotes to switch that button from "Join the waitlist"
// to "Buy now". Leave it empty and the button collects a waitlist sign-up instead.
//   pdf   = The PDF
//   plan  = PDF + Training Plan
//   voice = PDF + Training Plan + Voice Feedback
window.BB_CHECKOUT = {
  'zero-to-runner': { pdf: 'https://buy.stripe.com/14A5kw1OF4Ui8PkaofaZi0v', plan: '', voice: '' },
  'run-faster': { pdf: 'https://buy.stripe.com/6oU5kw8d33Qe3v03ZRaZi0w', plan: 'https://buy.stripe.com/3cI14gctj4UighMcwnaZi0x', voice: 'https://buy.stripe.com/bJe4gsdxn9ay0iOcwnaZi0y' },
  '5k': { pdf: '', plan: '', voice: '' },
  '10k': { pdf: '', plan: '', voice: '' },
  '21k': { pdf: 'https://buy.stripe.com/3cI14g2SJ86u4z40NFaZi0u', plan: '', voice: '' },
  'marathon': { pdf: '', plan: '', voice: '' }
};
