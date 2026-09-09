# 010 — Bring Web to feature parity with Mobile

- **Status**: PROPOSED (awaiting decisions in "Open questions")
- **Scope**: frontend only. Every endpoint Mobile calls already exists in `app/api/`.
- **Surveyed**: `Sukrittt/envelope` @ `7cd1127`, `Sukrittt/envelope-mobile` @ `6a393de`

## 1. Where the two actually stand

| | Web (`envelope`) | Mobile (`envelope-mobile`, now "Aviary") |
| --- | --- | --- |
| Framework | Next 15 App Router | Expo SDK 57 + expo-router |
| Data fetching | `useSWR` in 3 views + a legacy `DashboardProvider` | TanStack Query, 30 hooks over 26 API modules |
| Styling | 10,771 lines of hand-written CSS (`App.css` 7,076 + `expense-redesign.css` 3,688) | `src/theme/tokens.ts`, typed `ThemeTokens`, light/dark/system |
| Accent | `--gold: oklch(70% 0.16 275)` (violet-blue) | `accent: #f4511e` (electric orange) |
| UI code | ~9k lines (4.2k views + 4.8k components) | ~25k lines |
| Screens | 6 app pages + 6 account/legal pages | 4 tabs + 14 modals + 10 stack screens |

**The API is not the problem.** Every endpoint Mobile hits — `/api/ai/brief`, `/api/ai/chat`,
`/api/archive`, `/api/expenses/scan`, `/api/feedback`, `/api/groups/move`,
`/api/recurring-expenses`, `/api/wrapped`, `/api/wrapped/status`,
`/api/notifications/register`, `/api/category-map/suggest` — is already implemented and
tested in this repo. This migration writes **zero backend code**.

## 2. The gap, endpoint by endpoint

Endpoints Mobile consumes that no Web view calls:

| Endpoint | Mobile surface | Web today |
| --- | --- | --- |
| `/api/ai/brief` | Money Brain brief cards | nothing |
| `/api/ai/chat` (SSE) | `modals/money-brain.tsx` (454 ln) | history list only, no chat |
| `/api/wrapped`, `/api/wrapped/status` | `app/wrapped.tsx` + `WrappedCards.tsx` (686 ln) | `wrappedAdapter.ts` exists, **no page**; account shows a placeholder card |
| `/api/recurring-expenses` | `account/recurring.tsx` (514) + `modals/recurring-expense.tsx` (394) | nothing |
| `/api/archive` | `account/archive.tsx` (1,076 ln) | nothing |
| `/api/expenses/scan` | `modals/scan-bill.tsx` + `features/scan-bill/*` (993 ln) | nothing |
| `/api/feedback` | `account/feedback.tsx` | nothing |
| `/api/groups/move` | group reordering in `envelopes.tsx` | nothing |
| `/api/notifications/register` | `account/notifications.tsx` | nothing (needs Web Push) |

Features with no endpoint of their own that Web also lacks:

- **Insights screen** (`app/insights.tsx`, 795 ln + `CategoryBreakdown.tsx` 1,308 ln + `Heatmap`,
  `TrendChart`, `DonutChart`, `AllocationBar`) — Web has fragments of this inlined in
  `ExpensePage.tsx` and `SpendingInsights.tsx`, at much lower fidelity.
- **Setup wizard** (`app/setup.tsx`, 661 ln — income → groups → categories → assign, with a
  weighted auto-allocation). Web's `/onboarding` is 3 static slides.
- **Guided tour** (`account/guided-tour.tsx` + 6 interactive demos, ~1,100 ln).
- **Envelope alert thresholds** (`alertPcts`, `DEFAULT_ALERT_PCTS`) — 5 Mobile files, 0 on Web.
- **Split expenses** (`lib/split.ts`, 46 Mobile files) — 0 on Web.
- **Expense-added celebration** (`modals/expense-added.tsx` 602 ln + `DeltaBar.tsx`) and the
  shared `CheckIcon` success pattern.
- **Edit-assigned-amount** full-screen flow, **collapsed groups**, **recent categories**,
  **category picker sheet**, **swipe-to-delete**.
- **Privacy / hide amounts** — 4 Web files vs 21 Mobile files. Partial on Web.

Web-only surfaces with no Mobile counterpart, and no place in the product:

- `/fitness` — renders a static `productivity/fitness/fitness-dashboard.sample.json`.
- `/learnings` — "Agent Learnings" from `dashboardService.ts`, which reads `mockData.json`
  and models departments, risks and KPIs. Pure Mission Control leftover.
- `mission-control-app/` — already documented as superseded.

## 3. The recommendation you probably don't want to hear

Read literally, "port all Mobile features to Web" means hand-translating ~22,000 lines of
React Native into DOM React, and then maintaining two copies forever. **That is how you got
here.** The drift is already visible and already load-bearing:

- Web's `expense-redesign.css` predates Mobile's orange rebrand and still ships a violet
  accent under a variable literally named `--gold`.
- `src/services/wrappedAdapter.ts` (plus its test) exists on Web with no screen to render it.
- `lib/http.ts:53` says *"Keep in sync with Mobile/src/lib/date.ts"* and
  `Mobile/src/lib/date.ts:22` says *"Keep in sync with Web/lib/http.ts."* A comment is not a
  mechanism.
- Mobile's files still address Web by relative path (`Web/src/services/api.ts`,
  `Web/app/api/feedback`) and vice versa (`Mobile/src/sync/flush.ts` in `PRODUCT.md`), which
  is what a codebase looks like after it's been split into two repos and hasn't accepted it.

So the plan below is not "port 22k lines." It is:

1. **Reunite the repos** (Mobile becomes `mobile/` in this repo, Web becomes `web/`).
2. **Extract the ~3,400 lines that are already platform-neutral** into `packages/core/`,
   consumed by both. Verified portable — no `react-native`/`expo` import in any of them:
   - `src/lib/`: `envelope.ts` (210), `monthly.ts` (292), `format.ts` (93), `emoji.ts` (51),
     `split.ts` (47), `recentCategories.ts` (39), `date.ts` (26), `constants.ts` (11),
     `alerts.ts` (8), `analytics.ts` (165)
   - `src/api/`: all 26 modules (~1,000 ln) behind one injected `apiFetch`
   - `src/hooks/`: all 30 TanStack Query hooks — TanStack Query is platform-agnostic, these
     move verbatim
   - `src/types/`
3. **Reimplement only the view layer** per platform, against shared hooks and shared tokens.

If you'd rather not merge the repos, say so and I'll re-plan around a published
`@envelope/core` npm package. It works, it just adds a version-bump to every shared change,
which for a solo developer is friction that tends to get bypassed.

## 4. Phases

Each phase is independently shippable. Estimates are relative effort, not calendar time.

### Phase 0 — Clear the ground (S)
Delete `/fitness`, `/learnings`, `mission-control-app/`, `dashboardService.ts`,
`mockData.json`, `productivity/*.sample.json`, `fitness*Adapter.ts`, and `src/types.ts`'s
department/risk/KPI models. Move the onboarding gate out of `DashboardProvider` (it is the
only thing in there worth keeping) into `middleware.ts` or the root layout, then delete the
provider. Strip `AppShell.tsx`'s hardcoded `"Hey Sukrit 👋"` and the `pageMeta` table for
routes that are going away.
**Ships:** a smaller repo and one less palette to fight in Phase 2.

### Phase 1 — Monorepo + shared core (M)
Merge `envelope-mobile` into this repo as `mobile/`; move Web to `web/`. Extract
`packages/core/` per §3.2. Web adopts `@tanstack/react-query`, deletes
`src/services/api.ts`, `budgetLoader.ts`, `expenseTransactions.ts`, `autoCategory.ts` and
rewires the three SWR views onto the shared hooks. `apiFetch` becomes an injected dependency:
Mobile passes the bearer-token version, Web passes the same-origin cookie version.
**Ships:** no user-visible change. This is the phase that makes every later phase cheap, and
the one it's most tempting to skip.

### Phase 2 — One design system (M)
Generate CSS custom properties from `packages/core/theme/tokens.ts` so
`ThemeTokens` stays the single source of truth. Retheme Web to the orange accent (including
the `accent`/`accentInk` contrast split, which Web currently has no equivalent of). Add
`system` to Web's theme preference (Web has light/dark only). Fold `expense-redesign.css` and
the surviving parts of `App.css` into one token-driven sheet. Resolve the product name —
Mobile ships as "Aviary", `PRODUCT.md` says "Envelope".
**Ships:** Web looks like the same product as the app.

### Phase 3 — Core screens (L)
Rebuild home / envelopes / activity against the shared hooks, at Mobile's fidelity:
collapsed groups, group + category reorder (`/api/groups/move`), inline category creation,
alert thresholds, split expenses, swipe-to-delete (pointer-events on Web), recent categories,
category picker, edit-assigned-amount, and the `CheckIcon` success pattern.
**Decision needed:** does Web mirror Mobile's 4-tab IA as routes, or keep a desktop
sidebar+dense-dashboard layout that maps the same features differently? See Q1.
**Ships:** the daily-use loop reaches parity.

### Phase 4 — Insights (M)
Port `app/insights.tsx` with `CategoryBreakdown`, `Heatmap`, `TrendChart`, `DonutChart`,
`AllocationBar`. Mobile draws these in `react-native-svg`; on Web they become plain SVG,
which is a straightforward translation — the layout math is the reusable part.
Retire `SpendingInsights.tsx` and the inline chart fragments in `ExpensePage.tsx`.

### Phase 5 — Money Brain + Wrapped (M)
Money Brain chat against `/api/ai/chat`. Web's streaming is *easier* than Mobile's:
`src/api/ai.ts` only reaches for `expo/fetch` because Hermes can't read streaming bodies —
browser `fetch` can, so the SSE frame parser ports and the transport shim drops out. Wire the
existing `wrappedAdapter.ts` to a real `/wrapped` route and replace the account placeholder
card. Add chat entry points to the existing `/account/chat-history` page.

### Phase 6 — Money management extras (M)
Recurring expenses (screen + modal), archive/restore, scan-bill (Web uses a file input +
`getUserMedia` instead of `expo-image-picker`; the review/confirm UI is the substantial part),
in-app feedback.

### Phase 7 — Onboarding, tour, prefs (M)
Replace the 3-slide `/onboarding` with the real setup wizard. Port the guided tour and its six
demos. Notification preferences — this is the one place a Web equivalent needs a decision:
`/api/notifications/register` takes Expo push tokens, so Web Push means either a new token
type on that route or leaving Web on email-only cadence. See Q4.

### Deliberately out of scope
Offline expense queueing (`pendingExpenses.ts` + `sync/flush.ts`), home-screen widgets
(`src/widgets/`), haptics, Lottie success tick. All either device-specific or a much larger
Web problem (service worker + Background Sync) than their value here.

## 5. Open questions

- **Q1 — Web IA.** Mirror Mobile's 4-tab structure as routes, or keep a desktop-first layout
  (persistent sidebar, denser panels) that presents the same features differently? This
  decides the shape of Phase 3 and everything after it.
- **Q2 — Repo shape.** Monorepo (recommended), a published `@envelope/core` package, or keep
  two repos and accept duplication?
- **Q3 — Name.** "Aviary" everywhere, or "Envelope" everywhere? Both strings are currently
  user-visible in different places.
- **Q4 — Web push.** Real Web Push notifications, or leave Web on email cadence only?
- **Q5 — Legacy deletion.** Confirm `/fitness`, `/learnings` and `mission-control-app/` can go.
