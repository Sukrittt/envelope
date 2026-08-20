# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Sukrit** — the primary and only real user. Opens the dashboard from desktop, typically a few times per week, to track and steer personal money: check envelope balances, assign income, move money between categories, review transactions and subscriptions, and glance at investments.
- **Demo guests** — visitors who open the deployed app without the password. They see the same interface over read-only sample data. They are evaluators, not users; nothing about the product may require them to have real data or an account.

## Product Purpose

Mission Control is a self-hosted, YNAB-style personal finance dashboard: envelope budgeting, expense tracking, subscriptions, and investments in one cockpit, so Sukrit knows exactly how much is safe to spend and where money is going — without handing his financial data to a third party. Success means he can answer "what's my spending state right now?" at a glance and act (assign, move, recategorize) in seconds.

## Positioning

A YNAB-style budgeting tool that is fully self-hosted: real financial data lives in his own MongoDB and private CSVs, never in a SaaS. The meaningful mechanism over a generic ledger is **envelope budgeting** — assign income to category envelopes, watch Ready to Assign, move money between envelopes, roll balances across months — plus an **auto-categorization** layer that learns a keyword → category map from past expenses and suggests categories for new entries.

## Operating Context

- Currency is INR (₹), formatted `en-IN`.
- A monthly money cycle: salary credited on the 4th, then income is assigned to envelopes, with a fixed investment sweep (~₹40,000/mo) and spendable pool (~₹40–45,000). Rent, subscriptions, food, travel/commute, and football are the heavy categories.
- Deployment is Vercel with MongoDB (Atlas or local) as the single store; the DB is seeded from local CSVs by a one-off migrate script. The real-personal CSVs are gitignored; only `demo/` sample CSVs ship with the repo.
- Auth is WorkOS AuthKit. Signed-in users read and write their own data, scoped by a `user_id` on every document. There is no guest/demo path in the UI any more — every app page requires a session, and a signed-out browser visitor is redirected to sign in. The read-only demo account (`DEMO_USER_ID`) still exists as the backend's fallback scope for any API request that arrives without a session (e.g. a direct/test request bypassing the browser); every non-GET from it still returns 403.

## Capabilities and Constraints

Confirmed capabilities:

- Envelope budgeting: monthly budgets per category, categories in groups, Ready to Assign, move money between envelopes, month rollover, persist envelope-to-envelope transfers.
- Transactions: inline entry, edit and recategorize from the UI, click an envelope to filter the log, auto-category suggestions from `/api/category-map`.
- Spending insights: daily/weekly/monthly trend charts, heatmap, sparklines, subscription timeline.
- Subscriptions: track services and amounts, cancel/reactivate, next-due dates.
- Investments: holdings and net worth, market updates, contributions/withdrawals, event log.
- Appearance: light/dark theme and comfortable/compact density, persisted to localStorage.

Constraints and boundaries:

- **Fitness and learnings pages are experiments**, running on bundled sample data, not real product surfaces. Do not treat them as first-class until wired to real data.
- Real accounts are created by anyone who signs in (Google or email code) and data is scoped per `user_id`, so the schema supports multiple accounts — but Sukrit remains the only *intended* real user; there's no multi-user or household model (shared envelopes, invites, permissions) on top of that scoping.
- API is route handlers under `app/api/`, each resolving `real` vs `guest` scope from the Bearer token.
- Personal financial data is private by design and never committed to git.
- Balance/cashflow reconciliation tracking was paused by Sukrit (2026-03) as too troublesome — not a feature to expand.

## Brand Commitments

- Name: **Mission Control**. The app is finance-first: budget, expenses, and investments are the product; fitness and learnings are garnish.
- Working title in layout metadata reads "YNAB Replacement" — a positioning nod, not a committed brand.
- No binding visual identity, voice, or assets have been committed. (No logo, tagline, or palette constraints are in force.)

## Evidence on Hand

- Sample/demo data committed at `data/demo/` and `src/data/*.sample.json` (fitness, expense panels, mock data) and `public/hero.png`.
- Real CSVs live under `productivity/` and `data/` on disk but are gitignored — treat as private evidence, never reproducible in a demo or doc.
- No testimonials, press, case studies, or public screenshots exist. Absence is a fact: future work must not fabricate social proof.

## Product Principles

1. **Finance-first.** Envelope budgeting and investments define the product; any surface that isn't wired to real financial data is an experiment, not a commitment.
2. **Answer the money question in seconds.** Every screen should let Sukrit read state at a glance and act (assign, move, recategorize) directly — the dashboard is a cockpit, not a form maze.
3. **Privacy by default.** Real financial data stays in his own store; guests and demos only ever see curated sample data.
4. **Self-hosted independence.** Core money management must not depend on a third-party SaaS to function.
5. **Direct manipulation over workflow.** Inline entry, click-to-filter, and move-money-within-reach outrank wizard-style flows.
