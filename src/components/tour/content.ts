// Static copy and demo data for the guided tour (app/account/guided-tour).
// Every number here is fake. Nothing in this file reads or writes real money,
// which is what lets each chapter be poked at without consequence.
//
// Twin of Mobile's src/components/tour/content.ts. `href` targets Web routes
// instead of Expo routes — chapter 2 and 5 have no route of their own on Web
// (log-expense and money-brain are a modal and a drawer, not pages), so their
// `linkNote` spells out how to reach them from the page they link to instead.

export interface Chapter {
  /** Row title on the hub, and the header subtitle while the chapter is open. */
  title: string
  blurb: string
  kicker: string
  lede: string
  /** The one thing to try. Swapped for a done line once the chapter completes. */
  nudge: string
  /** "Try it for real" row: label plus the real route it opens. */
  linkLabel: string
  href: string
  /** Overrides the row's default subtitle — for a chapter whose real screen
   * needs an extra step spelled out (e.g. opening a modal from elsewhere). */
  linkNote?: string
}

export const CHAPTERS: Chapter[] = [
  {
    title: 'Envelopes & Ready to Assign',
    blurb: 'Money gets a job before it gets spent.',
    kicker: 'CHAPTER 1 OF 6',
    lede: "Every category is an envelope. Your income shows up as one number, Ready to Assign, and you hand it out until there's nothing left to hand out.",
    nudge: 'Fund all four. Get Ready to Assign to zero.',
    linkLabel: 'Open Home',
    href: '/expense',
    linkNote: 'Click a category, then "Edit assigned amount"',
  },
  {
    title: 'Logging money',
    blurb: 'One expense drains one envelope. Nothing else.',
    kicker: 'CHAPTER 2 OF 6',
    lede: 'Log what you spent and it comes out of that envelope only. So Fun going wild never quietly eats Groceries.',
    nudge: 'Log one and watch exactly one bar move.',
    linkLabel: 'Open Log expense',
    href: '/expense',
    linkNote: 'Click "Log expense" on Home',
  },
  {
    title: 'Move money',
    blurb: 'Short somewhere? Borrow from somewhere with slack.',
    kicker: 'CHAPTER 3 OF 6',
    lede: "An envelope can't cover a bill. Pull the difference from one that can. Sources are ranked by how much room they actually have.",
    nudge: 'Cover the ₹1,400 shortfall. Pick a source.',
    linkLabel: 'Open Home',
    href: '/expense',
    linkNote: 'Click a category, then "Move money between envelopes"',
  },
  {
    title: 'The new month',
    blurb: "Your plan carries. Your leftovers don't.",
    kicker: 'CHAPTER 4 OF 6',
    lede: 'This is the bit everyone gets wrong, so we made it a quiz.',
    nudge: 'Answer, then flip to October 1.',
    linkLabel: 'Open Insights',
    href: '/insights',
  },
  {
    title: 'Understanding your money',
    blurb: 'Insights, plus a brain you can interrogate.',
    kicker: 'CHAPTER 5 OF 6',
    lede: 'Insights steps back month by month: normal or not, where it went, a daily heatmap. Money Brain answers in plain language, having actually read your envelopes.',
    nudge: 'Ask it something nosy.',
    linkLabel: 'Open Money Brain',
    href: '/expense',
    linkNote: 'Opens the Money Brain drawer',
  },
  {
    title: 'Everything else',
    blurb: 'Seven smaller things, one line each.',
    kicker: 'CHAPTER 6 OF 6',
    lede: "The rest of the app on one screen. Click whatever you're curious about.",
    nudge: 'Open a couple.',
    linkLabel: 'Open Archive',
    href: '/account/archive',
  },
]

export const TOUR_INCOME = 42000

export const ASSIGN_ROWS = [
  { id: 'rent', name: 'Rent', emoji: '🏠', plan: 22000 },
  { id: 'groceries', name: 'Groceries', emoji: '🛒', plan: 9000 },
  { id: 'bills', name: 'Bills', emoji: '🧾', plan: 6000 },
  { id: 'fun', name: 'Fun', emoji: '🎟️', plan: 5000 },
] as const

export const SPEND_ROWS = [
  { id: 'groceries', name: 'Groceries', emoji: '🛒', plan: 9000, spent: 3000 },
  { id: 'eatout', name: 'Eating Out', emoji: '🍲', plan: 4000, spent: 2200 },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', plan: 6000, spent: 1500 },
] as const

export const LOG_CHIPS = [
  { id: 'g', category: 'groceries', amount: 450, what: 'Sabzi run', method: 'UPI', emoji: '🛒' },
  { id: 'e', category: 'eatout', amount: 700, what: 'Dosa night', method: 'Card', emoji: '🍲' },
  { id: 's', category: 'shopping', amount: 1900, what: 'Running shoes', method: 'Card', emoji: '🛍️' },
] as const

/** The bill chapter 3 is short on, and how much is already in its envelope. */
export const MOVE_NEED = 2000
export const MOVE_IN_ENVELOPE = 600
export const MOVE_AMOUNT = 1400

export const MOVE_SOURCES = [
  { id: 'fun', name: 'Fun', emoji: '🎟️', available: 4000, note: 'Mostly unspent · safe to borrow' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', available: 2000, note: '45% of budget left' },
  { id: 'rent', name: 'Rent', emoji: '🏠', available: 9000, note: 'Set aside · bill due 5th', protected: true },
] as const

export const ROLLOVER_ROWS = [
  { name: 'Groceries', emoji: '🛒', plan: 9000, left: 1200, creditCard: false },
  { name: 'Fun', emoji: '🎟️', plan: 5000, left: 2600, creditCard: false },
  { name: 'Rent', emoji: '🏠', plan: 22000, left: 0, creditCard: false },
  { name: 'Credit Card Payment', emoji: '💳', plan: 2600, left: 2600, creditCard: true },
] as const

export const QUIZ_QUESTION = 'You end September with ₹2,600 still sitting in Fun. On the 1st, what happens to it?'

export const QUIZ_OPTIONS = [
  {
    id: 'a',
    label: "It rolls into October's Fun. ₹7,600 to play with",
    correct: false,
    feedback: "Nope, that's the other budgeting apps. Leftovers don't compound here.",
  },
  {
    id: 'b',
    label: 'It is gone. October starts fresh, with the same ₹5,000 plan',
    correct: true,
    feedback:
      "Exactly. Clean slate on the 1st: the leftover disappears, but your ₹5,000 plan is already sitting there waiting, so you're not budgeting from zero.",
  },
  {
    id: 'c',
    label: 'It goes back to Ready to Assign to redistribute',
    correct: false,
    feedback:
      'Close, but no. A month just starts fresh. Nothing gets handed back, and there\'s no "start new month" button to press.',
  },
] as const

/** Chapter 5's normal-month comparison, mirroring what Insights actually plots. */
export const NORMAL_BARS = [
  { label: 'This month so far', value: 18400, accent: true },
  { label: 'Usual by day 22', value: 16500, accent: false },
] as const
export const NORMAL_BAR_MAX = 22000

export const BRAIN_ASKS = [
  {
    q: 'Am I overspending?',
    a: "You're ₹1,900 ahead of your usual pace and it's almost entirely Shopping, the shoes. Groceries and Fun are both tracking normal.",
  },
  {
    q: 'Where did Fun go?',
    a: "₹2,400 of Fun this month: two dinners out and a concert ticket. There's still ₹2,600 sitting in the envelope.",
  },
  {
    q: 'Can I afford a ₹8,000 trip?',
    a: "Not without borrowing. Fun and Shopping together have ₹6,600 of slack. The rest would have to come out of next month's plan.",
  },
] as const

export const EXTRAS = [
  {
    name: 'Expense Wrapped',
    emoji: '🎧',
    desc: 'A monthly story of your spending: total, top category, biggest buy, streaks, badges and a spending archetype, with music and a card worth sharing. It unlocks on the 1st once you\'ve logged enough.',
  },
  {
    name: 'Subscriptions',
    emoji: '📺',
    desc: 'Every recurring service with its cycle and next due date, an allocation bar in Insights with brand colors, and a nudge before it renews.',
  },
  {
    name: 'Activity & Archive',
    emoji: '🗄️',
    desc: 'Every transaction in one searchable, filterable list with a running total. Delete something and it waits in the Archive on a countdown. Restore one thing, or all of it.',
  },
  {
    name: 'Investments',
    emoji: '📈',
    desc: 'Log holdings by type, from equity and FDs to mutual funds, gold, crypto and bonds, then see the portfolio total plus allocation at a glance.',
  },
  {
    name: 'Alerts & digests',
    emoji: '🔔',
    desc: 'Per-envelope warnings at 50%, 90% and 100%, or your own number, bill reminders 1, 3 or 7 days ahead, and a daily or weekly digest if you want one.',
  },
  {
    name: 'Scan a bill',
    emoji: '📷',
    desc: 'Photograph or drag in a receipt and it reads the line items, splits them by however many people ate, and files each into an envelope before logging.',
  },
  {
    name: 'Your data & privacy',
    emoji: '🔒',
    desc: 'Export everything to a file or wipe your transactions. Yours, always. Light, dark or system theme, and a switch that blurs every amount the moment the page opens.',
  },
] as const
