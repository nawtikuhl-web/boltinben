// The 100 pre-run fuels, as shown on /fuel/guide.
// Each section has an id (used in the jump menu link), a heading, an optional
// line under the heading, and its fuels. Each fuel is { name, note }:
// the name in bold, the note is a short line on why or how much.
//
// Ben: fill these from the Pre-Run Fuels PDF. Sections with no fuels yet show
// a short "coming soon" line instead of an empty box.
window.FUEL_SECTIONS = [
  {
    id: 'two-hours',
    heading: '2+ hours before',
    line: 'a proper meal. carbs first, some protein, not much fat or fibre.',
    fuels: []
  },
  {
    id: 'one-hour',
    heading: 'about 1 hour before',
    line: 'a snack, not a meal. easy carbs, small portion.',
    fuels: []
  },
  {
    id: 'thirty-minutes',
    heading: '30 minutes or less',
    line: 'small and simple. something your stomach barely notices.',
    fuels: []
  },
  {
    id: 'long-runs',
    heading: 'long runs (over 75 min)',
    line: 'top up before, and plan what you will take with you.',
    fuels: []
  },
  {
    id: 'sensitive-stomach',
    heading: 'if your stomach hates you',
    line: 'gentle options for nervous or sensitive guts.',
    fuels: []
  }
];
