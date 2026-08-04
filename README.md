# Mission Control

A self-hosted personal finance dashboard — a YNAB-style alternative for envelope budgeting, expense tracking, subscriptions, and investments. Built with Next.js and MongoDB, with a password-gated guest mode so visitors can explore on sample data.

## Highlights

- **Envelope budgeting** — assign a monthly budget per category, organize categories into groups, see Ready to Assign, move money between envelopes, and roll amounts over across months.
- **Transactions** — add entries inline, recategorize them, and click an envelope to filter the transaction log by that category.
- **Auto-categorization** — the API learns a keyword → category map from past expenses (`/api/category-map`) and suggests categories for new entries.
- **Spending insights** — daily/weekly/monthly trend charts, a heatmap, sparklines, and a subscription timeline.
- **Subscriptions** — track services and amounts, cancel/reactivate, and see next-due dates.
- **Investments** — holdings and net worth, market updates, contributions/withdrawals, and an event log.
- **Guest demo mode** — a password gate protects real data; guests explore on read-only sample data.
- **Theme & density** — light/dark theme and comfortable/compact density, persisted to localStorage.

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
| Guest demo (read-only) | `demo_expenses`, `demo_budgets`, `demo_categories`, `demo_groups`, `demo_subscriptions`, `demo_holdings`, `demo_holding_events` |

The database is seeded from local CSV files (see [Data migration](#data-migration)). The real-data CSVs are **gitignored** — they hold personal financial data and are never committed; only the sample `demo/` CSVs ship with the repo.

## Authentication & guest mode

The app is wrapped in an `AuthGate`. When `NEXT_PUBLIC_DASHBOARD_PASSWORD` is set, the app starts locked behind a password dialog; visitors can also choose **Continue as guest**.

- **Real mode** — unlocked with the password. Every API call sends it as a `Authorization: Bearer <password>` header, which the server verifies (constant-time) to grant read-write access to the real collections.
- **Guest mode** — no token. Read-only access to the `demo_*` collections; every non-GET request returns `403`.
- If no password is configured, the gate auto-unlocks and the API treats all requests as real mode — convenient for local-only use.
- The chosen mode persists in `localStorage` (`mc-access`) for 30 days. Use **Log out** / **Exit guest mode** in the sidebar or Settings to clear it.

## API

Route handlers are the CSV-era `/api/*` endpoints, now backed by MongoDB. Each request resolves `real` vs `guest` scope from its Bearer token.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/expenses` | GET, POST, PUT | Transaction log; PUT also recategorizes |
| `/api/budgets` | GET, POST, PUT, DELETE | Monthly envelope budgets |
| `/api/categories` | GET, POST, PUT, DELETE | Envelope categories |
| `/api/categories/reorder` | POST | Move a category up/down |
| `/api/categories/move` | POST | Drag a category to an index |
| `/api/category-map` | GET | Keyword → category suggestions |
| `/api/groups` | GET, POST, PUT, DELETE | Category groups |
| `/api/subscriptions` | GET, POST, PUT | Subscriptions |
| `/api/holdings` | GET, POST, PUT, DELETE | Investment holdings |
| `/api/holdings/action` | POST | Contribution / withdrawal |
| `/api/holding-events` | GET | Holding event log |

## Routes

| Route | Page |
| --- | --- |
| `/` | Redirects to `/expense` |
| `/expense` | Budget dashboard |
| `/expense/transactions` | Transaction log |
| `/investments` | Investments / net worth |
| `/fitness` | Fitness dashboard (bundled sample data) |
| `/learnings` | Agent learnings |
| `/settings` | Appearance, density, session |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Required. MongoDB connection string (Atlas or local). |
| `NEXT_PUBLIC_DASHBOARD_PASSWORD` | Optional. Password for real mode + API Bearer token. Empty = open. |

## Data migration

The database is seeded from local CSV files by a one-off script. This reads the real data in `productivity/` and `data/` (kept out of git) plus the committed sample data in `productivity/demo/` and `data/demo/`, and upserts each row into MongoDB:

```bash
npm run db:migrate   # requires MONGODB_URI in .env.local or the environment
```

Collections keyed by a natural field (`budgets`, `categories`, `groups`, `subscriptions`, `holdings`) upsert in place; append-only logs (`expenses`, `holding_events`) are cleared and re-inserted.

## Local development

```bash
cp .env.example .env.local   # set MONGODB_URI (and a password if you want the gate)
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
- Set `NEXT_PUBLIC_DASHBOARD_PASSWORD` if you want the gate locked in production.

## Scripts

- `npm run db:migrate` — seed MongoDB from local CSVs (`scripts/migrate-to-mongo.mjs`)
- `npm run sync:expenses` — sync the expense CSVs (`scripts/sync_expenses.mjs`)
