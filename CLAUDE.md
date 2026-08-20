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

Real data lives in MongoDB; the app was migrated off flat CSVs (`productivity/`, `data/` — gitignored, personal data). Collections mirror the old CSV files: `expenses`, `budgets`, `categories`, `groups`, `subscriptions`, `holdings`, `holding_events`. Every document carries a `user_id` (a WorkOS user id); the demo account is just another `user_id`, so the old `demo_*` mirror collections are gone. `lib/models.ts` documents header/field shapes; `{ headers, rows }` response shape is preserved from the CSV era so `src/services/api.ts` needs no reshaping.

### Auth / scope model

Auth is WorkOS AuthKit. Every API route resolves an `Auth` (`{ userId, readOnly }`) per-request via `lib/access.ts::getAuth`, which tries three things in order: an `Authorization: Bearer <jwt>` verified against WorkOS's JWKS (the mobile app), the AuthKit session cookie via `withAuth()` (the web app, same-origin so the token never reaches browser JS), then the read-only demo user (`DEMO_USER_ID`) for anyone signed out. There's no hosted AuthKit page — Google goes straight to Google's consent screen (`provider: 'GoogleOAuth'`, skips the AuthKit picker) via `app/api/auth/google`, and email uses magic-auth codes via `app/api/auth/magic-auth/*`. Both call `saveSession()` from `@workos-inc/authkit-nextjs` directly, since neither goes through `handleAuth()`.

A local `users` collection (`lib/users.ts`) holds WorkOS-account metadata (email, name) for attaching app-specific data to a person — kept in sync JIT, not via webhook: `ensureUser()` upserts from the `user` object already returned by a fresh sign-in (the two auth routes above), `ensureUserById()` upserts by id alone — fetching from WorkOS only if the row is missing — for the mobile app, which authenticates directly against WorkOS and only touches this backend via `app/api/auth/verify`. `scripts/sync-users.mjs` seeds/re-syncs it on demand. The JWT's `sub` is still the tenant key for data scoping; this collection is metadata, not the source of truth for who owns what.

Tenancy is enforced at the choke point, not per handler: `getCollection(base, auth)` returns a `ScopedCollection` (`lib/scoped.ts`) that injects `user_id` into every filter and stamps it onto every insert, including inside `bulkWrite`. When adding a new API route, follow the existing pattern: `const auth = await getAuth(req)`, call `readOnlyGuard(auth, method)` for mutations, and use `getCollection(base, auth)` — never `db.collection()` directly, which bypasses scoping.

Caches must be keyed by user id too (`lib/cache.ts`, and the module-level map in `app/api/category-map/route.ts`) — a cache keyed only by collection name serves one user's rows to the next.

Web routes: `app/api/auth/google` + `.../google/callback` (Google sign-in), `app/api/auth/magic-auth/send` + `.../verify` (email sign-in), `app/logout` (plain href client components can navigate to, since `signOut` is server-only). `middleware.ts` refreshes the session cookie but deliberately never forces sign-in.

### Routes

`/` → redirects to `/expense`. Pages: `/expense` (budget dashboard), `/expense/transactions`, `/investments`, `/fitness`, `/learnings`, `/settings`.

## Breaking Long-Running Tasks

For any task expected to span multiple tool calls or involve 3+ files:
1. Create a todo list at the start (use Todowrite tool)
2. Mark items `in_progress` as you work them
3. Mark `completed` only after verified done (not just "written")
4. Keep exactly one `in_progress` at a time
5. If blocked, add follow-up todo describing the blocker

## Repo-root docs

`PRODUCT.md` and `FLUID_INTERACTIONS.md` at the repo root contain product/interaction-design notes worth checking before UI work. `plans/` holds planning docs for past feature work.
