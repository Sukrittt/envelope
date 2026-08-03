# YNAB Replacement

React + Vite + TypeScript personal finance dashboard — a self-hosted, CSV-backed alternative to YNAB. Track budgets, expenses, subscriptions, and investments, with a password-gated guest mode so visitors can explore on sample data.

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

- React 19, TypeScript, Vite
- `react-router-dom` v7 for routing
- `lucide-react` for icons
- No separate backend — a CSV-backed JSON API middleware lives in `vite.config.ts`

## How data is stored

There is no database. A Vite dev/preview-server middleware (the `csv-api` plugin in `vite.config.ts`) serves `/api/*` endpoints that read and write CSV files:

- `productivity/expenses.csv`, `budgets.csv`, `categories.csv`, `groups.csv` — expenses and budgeting
- `data/subscriptions.csv`, `holdings.csv`, `holding_events.csv` — subscriptions and investments
- `productivity/fitness/` — fitness module data
- `productivity/demo/` and `data/demo/` — sample datasets used in guest mode

The `prebuild` script copies the CSVs into `public/productivity/` so they ship with a static build.

## Routes

| Route | Page |
| --- | --- |
| `/expense` | Budget dashboard |
| `/expense/transactions` | Transaction log |
| `/investments` | Investments / net worth |
| `/fitness` | Fitness dashboard |
| `/learnings` | Agent learnings |
| `/settings` | Appearance, density, session |

Unknown routes redirect to `/expense`.

## Guest mode & authentication

`AuthGate` wraps the app. When `VITE_DASHBOARD_PASSWORD` is set, the app starts locked behind a password dialog; visitors can also choose **Continue as guest**.

- **Real mode** — unlocked with the password; reads and writes the live CSVs.
- **Guest mode** — read-only; every non-GET `/api/*` request is rejected with 403, and data is served from the demo CSVs (`?mode=guest`).
- The chosen mode persists in `localStorage` (`mc-access`) for 30 days. Use **Log out** / **Exit guest mode** in the sidebar or Settings to clear it.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_DASHBOARD_PASSWORD` | Optional. When set, the app requires a password to enter real mode. |
| `VITE_API_BASE_URL` | Legacy optional backend for the master dashboard (`dashboardService`); the current routes do not use it and fall back to `src/data/mockData.json`. |

## Local development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

## Deploy

Static Vite build:

- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_DASHBOARD_PASSWORD` if you want the gate locked in production.

Note: the CSV API is served by the Vite dev/preview-server middleware, so a fully static host needs that middleware (or a serverless equivalent) for `/api/*` calls to work.

## Scripts

- `npm run sync:expenses` — runs `scripts/sync_expenses.mjs` to sync the expense CSVs.
