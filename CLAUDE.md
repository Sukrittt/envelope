# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server
npm run build          # type-checks (lint is deferred, see below); production build
npm run lint            # eslint (not run during build)
npm run db:migrate    # seed MongoDB from local CSVs (scripts/migrate-to-mongo.mjs), needs MONGODB_URI
npm run sync:expenses  # sync expense CSVs (scripts/sync_expenses.mjs)
```

No test runner is configured. `next.config.ts` sets `eslint.ignoreDuringBuilds: true`, so `npm run build` only type-checks — run `npm run lint` separately.

## Architecture

Next.js 15 App Router app, but routing and views are deliberately split:

- **`app/`** — route layer only. Each `app/<route>/page.tsx` is a thin wrapper that imports and renders a view from `src/views/`. `app/api/*` route handlers contain the actual server logic (no separate view layer for API).
- **`src/`** — the real frontend: `src/views/` (one per route), `src/components/`, `src/context/` (DashboardProvider), `src/services/` (client-side adapters/loaders that call the API and shape data for views), `src/types/`.
- **`lib/`** — server-side helpers used by `app/api/*` route handlers: `lib/mongodb.ts` (cached MongoClient on `globalThis`), `lib/access.ts` (auth/scope resolution), `lib/http.ts` (response helpers, `getCollection`), `lib/models.ts` (Mongo document field names — kept as the legacy CSV header/snake_case names on purpose, see file header comment), `lib/categoryMap.ts`.
- **`@/*` path alias** maps to the repo root (`tsconfig.json`), so `lib/`, `components/`, `src/` are all reachable as `@/lib/...`, `@/components/...`, `@/src/...`. `app/*/page.tsx` files use relative imports into `src/views/` instead.
- **`mission-control-app/`** — legacy prototype, superseded by `app/` + `src/`. Not imported from anywhere; leave it alone unless asked.

### Data layer

Real data lives in MongoDB; the app was migrated off flat CSVs (`productivity/`, `data/` — gitignored, personal data). Collections mirror the old CSV files: `expenses`, `budgets`, `categories`, `groups`, `subscriptions`, `holdings`, `holding_events`, plus read-only `demo_*` mirrors for guest mode. `lib/models.ts` documents header/field shapes; `{ headers, rows }` response shape is preserved from the CSV era so `src/services/api.ts` needs no reshaping.

### Auth / scope model

Every API route resolves a `Scope` (`'real' | 'guest'`) per-request via `lib/access.ts::getScope`, based on an `Authorization: Bearer <password>` header checked against `NEXT_PUBLIC_DASHBOARD_PASSWORD` (constant-time compare). No password configured → everything is open/`real`. Guest scope reads `demo_*` collections and is rejected on any non-GET via `guestWriteGuard`. When adding a new API route, follow the existing pattern: resolve scope, call `guestWriteGuard` for mutations, use `getCollection(base, scope)` rather than hardcoding collection names.

### Routes

`/` → redirects to `/expense`. Pages: `/expense` (budget dashboard), `/expense/transactions`, `/investments`, `/fitness`, `/learnings`, `/settings`.

## Repo-root docs

`PRODUCT.md` and `FLUID_INTERACTIONS.md` at the repo root contain product/interaction-design notes worth checking before UI work. `plans/` holds planning docs for past feature work.
