// Stripe payment links for every plan and option.
// One option per plan for now (Ben, 24 Nov 2026): the PDF, with the
// Ultimate Running Bible free. plan and voice are kept for the TrainingPeaks
// upsell later; nothing on the pages links to them at the moment.
//   pdf   = The PDF (+ the Ultimate Running Bible, sent by the Sparkies webhook)
//   plan  = PDF + Training Plan (not shown)
//   voice = PDF + Training Plan + Voice Feedback (not shown)
window.BB_CHECKOUT = {
  'zero-to-runner': { pdf: 'https://buy.stripe.com/14A5kw1OF4Ui8PkaofaZi0v', plan: '', voice: '' },
  'run-faster': { pdf: 'https://buy.stripe.com/6oU5kw8d33Qe3v03ZRaZi0w', plan: 'https://buy.stripe.com/3cI14gctj4UighMcwnaZi0x', voice: 'https://buy.stripe.com/bJe4gsdxn9ay0iOcwnaZi0y' },
  '5k': { pdf: 'https://buy.stripe.com/9B6dR20KBeuS1mS0NFaZi0B', plan: '', voice: '' },
  '10k': { pdf: 'https://buy.stripe.com/dRmcMYeBraeCaXs8g7aZi0C', plan: '', voice: '' },
  '21k': { pdf: 'https://buy.stripe.com/3cI14g2SJ86u4z40NFaZi0u', plan: '', voice: '' },
  // The Base Builder Bible at /base-builder (US$19, success URL /base-builder/thanks).
  // pdf = the Stripe link for every buy button. watch = the TrainingPeaks
  // upsell on the thank-you page, watchPrice its label, e.g. 'US$29'.
  // Empty links fall back to an email to Ben.
  'base-builder': { pdf: 'https://buy.stripe.com/8x214gbpf86uaXs0NFaZi0F', watch: '', watchPrice: '' },
  'marathon': { pdf: 'https://buy.stripe.com/6oU14ggJz4Ui8Pk7c3aZi0D', plan: '', voice: '' }
};
