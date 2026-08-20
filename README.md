# Mission Control

A self-hosted personal finance dashboard — a YNAB-style alternative for envelope budgeting, expense tracking, subscriptions, and investments. Built with Next.js and MongoDB, with WorkOS AuthKit for sign-in.

## Highlights

- **Envelope budgeting** — assign a monthly budget per category, organize categories into groups, see Ready to Assign, move money between envelopes, and roll amounts over across months.
- **Transactions** — add entries inline, recategorize them, and click an envelope to filter the transaction log by that category.
- **Auto-categorization** — the API learns a keyword → category map from past expenses (`/api/category-map`) and suggests categories for new entries.
- **Spending insights** — daily/weekly/monthly trend charts, a heatmap, sparklines, and a subscription timeline.
- **Subscriptions** — track services and amounts, cancel/reactivate, and see next-due dates.
- **Investments** — holdings and net worth, market updates, contributions/withdrawals, and an event log.
- **Onboarding tour** — a 3-slide walkthrough shown once per account after first sign-in.
- **Theme** — light/dark, persisted per account.

## Stack

- [Next.js 15](https://nextjs.org/) (App Router), React 19, TypeScript
- [MongoDB](https://www.mongodb.com/) via the official `mongodb` driver (Atlas or local)
- [lucide-react](https://lucide.dev/) for icons

## How data is stored

Data lives in MongoDB. The API route handlers under `app/api/` read and write these collections:

| Domain | Collections |
| --- | --- |
| Expenses & budgeting | `expenses`, `budgets`, `categories`, `groups` |
| Subscriptions | `subscriptions` |
| Investments | `holdings`, `holding_events` |
| Accounts & devices | `users`, `push_tokens` |

Every document carries a `user_id` (a WorkOS user id) — there are no separate `demo_*`
mirror collections; the demo account is just another `user_id` (`DEMO_USER_ID`).

The database is seeded from local CSV files (see [Data migration](#data-migration)). The real-data CSVs are **gitignored** — they hold personal financial data and are never committed; only the sample `demo/` CSVs ship with the repo.

## Authentication

Sign-in is WorkOS AuthKit, but never through WorkOS's hosted UI — Google goes straight
to Google's consent screen and email uses 6-digit magic-auth codes, both via
`/api/auth/*` (`app/(auth)/sign-in`, `/email`, `/code`). A first-time sign-in creates
the account; there is no separate signup step.

- `middleware.ts` gates every page except `/sign-in`, `/email`, `/code` behind a
  session cookie; signed-out visitors are redirected to `/sign-in`. `/api/*` is never
  gated by middleware — each route resolves its own auth via `lib/access.ts::getAuth`.
- New accounts land on `/onboarding` (a 3-slide tour) once, tracked via `onboardedAt`
  on the user's doc.
- `/api/*` requests without a valid session fall back to a read-only demo user
  (`DEMO_USER_ID`) — every non-GET from that user returns `403`. This is a backend
  fallback for API callers that bypass the browser (tests, curl); there is no "continue
  as guest" UI path in any page.
- `/account` (You), `/account/security`, `/account/data`, `/account/help` cover profile,
  sign-out-everywhere, delete account, data export (CSV/JSON), clear-transactions, and
  support links.

## API

Route handlers are the CSV-era `/api/*` endpoints, now backed by MongoDB. Each request
resolves its owning user id (real or demo) via `lib/access.ts::getAuth`.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/expenses` | GET, POST, PUT | Transaction log; PUT also recategorizes |
| `/api/budgets` | GET, POST, PUT, DELETE | Monthly envelope budgets |
| `/api/categories` | GET, POST, PUT, DELETE | Envelope categories |
| `/api/categories/reorder` | POST | Move a category up/down |
| `/api/categories/move` | POST | Drag a category to an index |
| `/api/category-map` | GET | Keyword → category suggestions |
| `/api/groups` | GET, POST, PUT, DELETE | Category groups |
| `/api/groups/move` | POST | Drag a group to an index |
| `/api/subscriptions` | GET, POST, PUT | Subscriptions |
| `/api/holdings` | GET, POST, PUT, DELETE | Investment holdings |
| `/api/holdings/action` | POST | Contribution / withdrawal |
| `/api/holding-events` | GET | Holding event log |
| `/api/user` | GET, PATCH, DELETE | Profile, preferences, onboarding flag; delete account |
| `/api/data/export` | GET | Export all of a user's data (`?format=csv\|json`) |
| `/api/data/summary` | GET | Transaction/envelope counts for the export screen |
| `/api/data/clear-transactions` | POST | Wipe transactions, keep envelopes |
| `/api/notifications/weekly` | GET | Cron-only (`CRON_SECRET`); sends the weekly spend digest |
| `/api/auth/google`, `/api/auth/magic-auth/*` | GET/POST | Sign-in |

## Routes

| Route | Page |
| --- | --- |
| `/` | Redirects to `/expense` |
| `/sign-in`, `/email`, `/code` | Sign-in flow |
| `/onboarding` | First-run tour |
| `/expense` | Budget dashboard |
| `/expense/transactions` | Transaction log |
| `/investments` | Investments / net worth |
| `/fitness` | Fitness dashboard (bundled sample data) |
| `/learnings` | Agent learnings |
| `/account`, `/account/security`, `/account/data`, `/account/help` | Profile, preferences, account & security, data export, help |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Required. MongoDB connection string (Atlas or local). |
| `WORKOS_CLIENT_ID` | WorkOS AuthKit client id. Use the same WorkOS environment locally and in production. |
| `WORKOS_API_KEY` | WorkOS API key. |
| `WORKOS_COOKIE_PASSWORD` | Encrypts the AuthKit session cookie. 32+ chars. |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Callback URL, also registered in the WorkOS dashboard. |
| `DEMO_USER_ID` | Owner of the sample data served to unauthenticated API requests. |
| `CRON_SECRET` | Bearer token Vercel Cron sends when invoking `/api/ai/scan-transactions` and `/api/notifications/weekly`. |
| `GEMINI_API_KEY` | LLM-assisted category suggestions and AI transaction scan. |

## Data migration

The database is seeded from local CSV files by a one-off script. This reads the real data in `productivity/` and `data/` (kept out of git) plus the committed sample data in `productivity/demo/` and `data/demo/`, and upserts each row into MongoDB:

```bash
npm run db:migrate   # requires MONGODB_URI in .env.local or the environment
```

Collections keyed by a natural field (`budgets`, `categories`, `groups`, `subscriptions`, `holdings`) upsert in place; append-only logs (`expenses`, `holding_events`) are cleared and re-inserted.

## Local development

```bash
cp .env.example .env.local   # set MONGODB_URI and the WORKOS_* vars
npm install
npm run db:migrate           # seed MongoDB from your local CSVs
npm run dev
```

## Checks

```bash
npm run lint
npm run build                # type-checks; lint is deferred (see eslint.config.mjs)
```

## Deploy

Deploy to Vercel. `vercel.json` pins the framework preset to `nextjs`, so the Next.js build output (`.next`) is used automatically.

- Set `MONGODB_URI` in the project's environment variables.
- Set the `WORKOS_*` vars and register the production callback URL in the WorkOS dashboard.

## Scripts

- `npm run db:migrate` — seed MongoDB from local CSVs (`scripts/migrate-to-mongo.mjs`)
- `npm run sync:expenses` — sync the expense CSVs (`scripts/sync_expenses.mjs`)
