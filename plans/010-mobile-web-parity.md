# 010 — Bring Web to feature parity with Mobile

- **Status**: ACCEPTED. Phases 0 through 5 done; phase 6 remains next in sequence.
- **Scope**: frontend only. Every endpoint Mobile calls already exists in `app/api/`.
- **Surveyed**: `Sukrittt/envelope` @ `7cd1127`, `Sukrittt/envelope-mobile` @ `6a393de`

## Decisions

| | Decision |
| --- | --- |
| **Web IA** | Desktop-first. Keep the sidebar shell; do not mirror Mobile's 4-tab layout. |
| **Code sharing** | None. Two repos, duplicated logic, accepted deliberately. |
| **Product name** | **Aviary**, everywhere. Web copy and `PRODUCT.md` get updated. |
| **Notifications** | Push stays mobile-only. No Web Push, no notification prefs UI on Web. |
| **Legacy code** | Delete `/fitness`, `/learnings`, `mission-control-app/` and the Mission Control data layer. |

Duplication is the choice that guarantees the two frontends keep drifting — it is what produced
today's gap (Web's accent still predates Mobile's orange rebrand; `wrappedAdapter.ts` ships with
no screen; `lib/http.ts:53` and `Mobile/src/lib/date.ts:22` each tell the other to "keep in
sync"). Phase 1 mitigates it as far as duplication allows: Web's data layer is structured as a
**file-for-file mirror** of Mobile's, same filenames, same exports, same query keys. Porting a
future Mobile change then means diffing one file against its twin rather than rediscovering
where the logic went.

## 1. Where the two actually stand

| | Web (`envelope`) | Mobile (`envelope-mobile` / Aviary) |
| --- | --- | --- |
| Framework | Next 15 App Router | Expo SDK 57 + expo-router |
| Data fetching | `useSWR` in 3 views + a legacy `DashboardProvider` | TanStack Query, 30 hooks over 26 API modules |
| Styling | 10,771 lines of CSS (`App.css` 7,076 + `expense-redesign.css` 3,688) | `src/theme/tokens.ts`, typed `ThemeTokens`, light/dark/system |
| Accent | `--gold: oklch(70% 0.16 275)` (violet-blue) | `accent: #f4511e` (electric orange) |
| UI code | ~9k lines (4.2k views + 4.8k components) | ~25k lines |
| Screens | 6 app pages + 6 account/legal pages | 4 tabs + 14 modals + 10 stack screens |

**The API is not the problem.** Every endpoint Mobile hits — `/api/ai/brief`, `/api/ai/chat`,
`/api/archive`, `/api/expenses/scan`, `/api/feedback`, `/api/groups/move`,
`/api/recurring-expenses`, `/api/wrapped`, `/api/wrapped/status`, `/api/category-map/suggest` —
is already implemented and tested here. This migration writes **zero backend code**.

## 2. The gap

Endpoints Mobile consumes that no Web view calls:

| Endpoint | Mobile surface | Web today |
| --- | --- | --- |
| `/api/ai/brief` | Money Brain brief cards | nothing |
| `/api/ai/chat` (SSE) | `modals/money-brain.tsx` (454 ln) | history list only, no chat |
| `/api/wrapped`, `/api/wrapped/status` | `app/wrapped.tsx` + `WrappedCards.tsx` (686 ln) | `wrappedAdapter.ts` exists, **no page**; account shows a placeholder |
| `/api/recurring-expenses` | `account/recurring.tsx` (514) + `modals/recurring-expense.tsx` (394) | nothing |
| `/api/archive` | `account/archive.tsx` (1,076 ln) | nothing |
| `/api/expenses/scan` | `modals/scan-bill.tsx` + `features/scan-bill/*` (993 ln) | nothing |
| `/api/feedback` | `account/feedback.tsx` | nothing |
| `/api/groups/move` | group reordering in `envelopes.tsx` | nothing |
| `/api/notifications/register` | `account/notifications.tsx` | **out of scope** (mobile-only) |

Features with no endpoint of their own that Web also lacks:

- **Insights screen** (`app/insights.tsx` 795 ln + `CategoryBreakdown.tsx` 1,308 ln + `Heatmap`,
  `TrendChart`, `DonutChart`, `AllocationBar`) — Web has fragments inlined in `ExpensePage.tsx`
  and `SpendingInsights.tsx`, at much lower fidelity.
- **Setup wizard** (`app/setup.tsx` 661 ln — income → groups → categories → assign, weighted
  auto-allocation). Web's `/onboarding` is 3 static slides.
- **Guided tour** (`account/guided-tour.tsx` + 6 interactive demos, ~1,100 ln).
- **Envelope alert thresholds** (`alertPcts`) — 5 Mobile files, 0 on Web.
- **Split expenses** (`lib/split.ts`) — 46 Mobile files, 0 on Web.
- **Expense-added celebration** (`modals/expense-added.tsx` 602 ln + `DeltaBar.tsx`) and the
  shared `CheckIcon` success pattern.
- **Edit-assigned-amount** flow, **collapsed groups**, **recent categories**, **category picker**,
  **swipe-to-delete**.
- **Privacy / hide amounts** — 4 Web files vs 21 Mobile files. Partial on Web.

## 3. Desktop-first IA

Mobile's tabs are not copied as tabs. The sidebar stays and gains real entries; Mobile's modals
become dialogs or right-hand drawers, and its full-screen stack pushes become routes.

| Mobile | Web route | Desktop treatment |
| --- | --- | --- |
| `(tabs)/index` home | `/expense` | Two-column: envelope list + a right rail carrying Ready-to-Assign, the AI brief and alerts. Mobile stacks these; desktop shows them at once. |
| `(tabs)/envelopes` | `/expense/envelopes` | Full-width group/category table with inline edit, drag reorder, alert thresholds. |
| `(tabs)/activity` | `/expense/transactions` | Existing `TransactionsView` extended: filter rail instead of chip sheet, row hover actions instead of swipe. |
| `(tabs)/more` | `/account` | Existing account shell; gains the entries below. |
| `insights` | `/insights` | Wider chart grid — Mobile scrolls these one per screen. |
| `investments` | `/investments` | Existing page, retheme only. |
| `wrapped` | `/wrapped` | Card deck, keyboard + click navigation. |
| `setup` | `/onboarding` | Replaces the 3 slides. |
| `account/{archive,recurring,guided-tour,feedback,data,security,help}` | same paths | Sidebar-nested. |
| `modals/*` | dialogs | `log-expense`, `move-money`, `edit-assigned-amount`, `subscription`, `recurring-expense`, `add-holding`, `holding-action`, `scan-bill`, `money-brain`. Money Brain is a right drawer, not a modal, so it can sit open beside the data it discusses. |

Mobile-only, not ported: offline queue (`pendingExpenses.ts`, `sync/flush.ts`), home-screen
widgets, haptics, Lottie tick, push notifications.

## 4. Phases

Each phase is independently shippable.

### Phase 0 — Clear the ground (S) — DONE
Delete `/fitness`, `/learnings`, `mission-control-app/`, `dashboardService.ts`, `mockData.json`,
`productivity/fitness/`, the fitness adapters and sample JSON, `src/types.ts`'s Mission Control
models, and the orphaned `StatusChip`/`TimelineList`/`SparkLine` components. Lift the onboarding
gate out of `DashboardProvider` — the only part worth keeping — then delete the provider,
context and hook. Strip `AppShell.tsx`'s hardcoded `"Hey Sukrit 👋"` and its `pageMeta` entries
for dead routes.
`src/App.css` is left intact here; Phase 2 folds it wholesale rather than picking rules out of
7,076 lines twice.

### Phase 1 — Web data layer, mirrored from Mobile (M) — DONE
Added `@tanstack/react-query`. `src/api/`, `src/hooks/` and `src/lib/` on Web are now
file-for-file twins of Mobile's, same exports and same query keys, with `apiFetch` sending the
same-origin cookie instead of a bearer token. Mobile's co-located tests came across (Jest to
Vitest is mechanical apart from `jest.requireActual`, whose vitest equivalent is async).

Where the platforms genuinely differ the twin says so in a comment: no 401 handler (web sends
no token and falls through to the demo user at 200), no `expo/fetch` shim in `ai.ts` (and a
reader loop, since a browser `ReadableStream` is not async-iterable in Chrome), no push-token
unregisters, no offline expense queue or encrypted category cache. `analytics.ts` keeps
Mobile's `AppEvent` union and `track()` signature over a sink so hook call sites stay
identical.

The four SecureStore-backed preference hooks share a new `usePersistentState` built on
`useSyncExternalStore`. Mobile hydrates them in an effect because SecureStore is async; on Web
that shape trips `react-hooks/set-state-in-effect`, and reading localStorage during render
desyncs server and client markup. Mobile clears them from a logout subscription; Web navigates
away to sign out, so `clearLocalPrefs()` runs from both sign-out controls first.

`InvestmentsPage` and `TransactionsPage` are on the hooks. **`ExpensePage` is not, and
`src/services/api.ts`, `budgetLoader.ts`, `expenseTransactions.ts`, `autoCategory.ts`,
`expensePanelLoader.ts` and `expensePanelAdapter.ts` stay for now** — deliberately. The ~5,000
lines still importing them (`ExpensePage` at 2,758, `TransactionsView` at 936, and five modals)
are exactly what Phase 3 rebuilds. Rewiring them to preserve today's UI, then deleting that
work a phase later, buys nothing a user can see. Their retirement moves to Phase 3, and until
then two data layers coexist: everything new goes through `src/hooks/`.

### Phase 2 — One design system (M) — DONE
Port `tokens.ts` to CSS custom properties with the same names, keeping `ThemeTokens` as the
shape of record. Retheme to the orange accent including the `accent`/`accentInk` contrast split
Web has no equivalent of. Add `system` to Web's theme preference (Web is light/dark only). Fold
`App.css` and `expense-redesign.css` into one token-driven sheet, scoped to the whole app rather
than to `/expense`. Rename the product to Aviary across Web copy, `PRODUCT.md` and `README.md`.
**Ships:** Web reads as the same product as the app.

Defining the ink tokens was only half the split: the sheets kept painting text with the raw
accent, which in light mode is 3.5:1 on white and fails small text. Fifteen `color:` rules now
read the ink instead (`--gold-ink` in `expense-redesign.css`, `--accent-strong` in `App.css`),
and `src/theme/tokens.test.ts` fails the build if a new one reaches for the raw accent again.

One residue, unfixed on purpose: accent-tinted chips (`--gold-soft`, an 18% accent wash) carry
ink text at 3.8:1 in light mode, still under 4.5:1. Closing that needs a darker `accentInk`
(around `#9a3412`), and since the token values are copied from Mobile verbatim, changing it here
alone re-creates the drift this phase kept finding. It belongs in Mobile's `tokens.ts` first.

### Phase 3 — Core screens (L) — DONE
Done:

- **`/expense/envelopes`**, net-new: group and category CRUD, drag reorder, inline creation,
  per-category alert thresholds. Deleting a group re-homes its categories into Archived first,
  which is why Archived has no delete control.
- **The service retirement carried over from Phase 1.** `src/services/` is down from 12 files
  to 4. `budgetLoader` went only after its own 11 tests were re-pointed at the ported
  `computeEnvelopeState` and passed unchanged — they stay as `src/lib/envelope.web.test.ts`.
  `expensePanelLoader` split into the pure `buildExpensePanel`; `autoCategory` and
  `expenseTransactions` moved to `src/lib` and lost their duplicated helpers.
- **Home and activity are on the query hooks.** Two round-trips went with it: stepping a month
  in insights recomputes from cached rows, and the rollover check reads `useBudgets`.
- **`hideAmounts`** became a persisted preference with a control on `/account`, next to a theme
  control that now offers the `Auto` option Phase 2 made possible.
- **Shared display helpers** (`envelopeDisplay.ts`, `envelopeGroups.ts`), which fixed a real
  drift: web compared against the UTC calendar date, so anything logged between 00:00 and
  05:29 IST read as "Yesterday" on the day it happened.

Completed in the final Phase 3 pass: the two-column desktop home, shared loading skeletons,
split expenses, the category picker and recent-category ordering in activity.

### Phase 4 — Insights (M) — DONE
`CategoryBreakdown`, `Heatmap`, `TrendChart`, `DonutChart`, `AllocationBar` at `/insights`.
Mobile draws these in `react-native-svg`; on Web they become plain SVG, so the layout math ports
and the primitives are rewritten. Retire `SpendingInsights.tsx` and `ExpensePage.tsx`'s inline
charts.

Shipped as a responsive `/insights` workspace with month navigation, a trailing 12-month trend,
category and group breakdowns, spend allocation, budget progress, interactive filtering and a
12-week activity heatmap. All five charts use browser-native SVG, and the old dashboard-specific
insights component and inline chart implementation have been removed.

### Phase 5 — Money Brain + Wrapped (M) — DONE
Money Brain as a right drawer over `/api/ai/chat`. Streaming is *easier* on Web: Mobile's
`src/api/ai.ts` only reaches for `expo/fetch` because Hermes can't read streaming bodies, so the
SSE frame parser ports and the transport shim drops out. Wire the existing `wrappedAdapter.ts` to
a real `/wrapped` route and replace the account placeholder card. Link chat from
`/account/chat-history`.

Shipped as a globally available, browser-native streaming drawer with brief cards, suggested
questions, searchable paginated history, resumable sessions and abort-on-close. `/wrapped` is a
full-screen story deck with autoplay, pause, click and keyboard navigation, reduced-motion support,
amount masking, budget-aware money-left copy and native share with clipboard fallback.

### Phase 6 — Money management extras (M)
Recurring expenses, archive/restore, scan-bill (file input + `getUserMedia` in place of
`expo-image-picker`; the review/confirm UI is the substantial part), in-app feedback.

### Phase 7 — Onboarding and tour (M)
The real setup wizard in place of the 3 slides, plus the guided tour and its six demos.

## 5. Notes for the executor

- Mobile's voice rules in its `CLAUDE.md` apply to any user-facing string written here: no em
  dashes, use contractions, never surface raw server text, `·` as separator.
- `SparkLine.tsx` is deleted in Phase 0 as orphaned but is a working web SVG line chart. Phase 4
  should recover it from git history rather than start from nothing.
