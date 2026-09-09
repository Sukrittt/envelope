# 010 — Bring Web to feature parity with Mobile

- **Status**: ACCEPTED. Phase 0 in progress.
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

### Phase 0 — Clear the ground (S) — IN PROGRESS
Delete `/fitness`, `/learnings`, `mission-control-app/`, `dashboardService.ts`, `mockData.json`,
`productivity/fitness/`, the fitness adapters and sample JSON, `src/types.ts`'s Mission Control
models, and the orphaned `StatusChip`/`TimelineList`/`SparkLine` components. Lift the onboarding
gate out of `DashboardProvider` — the only part worth keeping — then delete the provider,
context and hook. Strip `AppShell.tsx`'s hardcoded `"Hey Sukrit 👋"` and its `pageMeta` entries
for dead routes.
`src/App.css` is left intact here; Phase 2 folds it wholesale rather than picking rules out of
7,076 lines twice.

### Phase 1 — Web data layer, mirrored from Mobile (M)
Add `@tanstack/react-query`. Create `src/api/` and `src/hooks/` on Web as file-for-file twins of
Mobile's, same exports and query keys, with `apiFetch` being the same-origin cookie version
instead of the bearer one. Port `src/lib/`: `envelope.ts`, `monthly.ts`, `format.ts`, `emoji.ts`,
`split.ts`, `date.ts`, `alerts.ts`, `recentCategories.ts`, `constants.ts`. Retire
`src/services/api.ts`, `budgetLoader.ts`, `expenseTransactions.ts`, `autoCategory.ts` and the
three SWR call sites. Carry Mobile's co-located tests across (Jest → Vitest is near-mechanical).
**Ships:** no user-visible change, and every later phase gets cheap.

### Phase 2 — One design system (M)
Port `tokens.ts` to CSS custom properties with the same names, keeping `ThemeTokens` as the
shape of record. Retheme to the orange accent including the `accent`/`accentInk` contrast split
Web has no equivalent of. Add `system` to Web's theme preference (Web is light/dark only). Fold
`App.css` and `expense-redesign.css` into one token-driven sheet, scoped to the whole app rather
than to `/expense`. Rename the product to Aviary across Web copy, `PRODUCT.md` and `README.md`.
**Ships:** Web reads as the same product as the app.

### Phase 3 — Core screens (L)
Home, envelopes and activity at Mobile's fidelity in the desktop layout of §3: collapsed groups,
group + category reorder, inline category creation, alert thresholds, split expenses, row hover
actions, recent categories, category picker, edit-assigned-amount, and the shared `CheckIcon`
success pattern. `ExpensePage.tsx` (2,758 ln) is decomposed here rather than extended.

### Phase 4 — Insights (M)
`CategoryBreakdown`, `Heatmap`, `TrendChart`, `DonutChart`, `AllocationBar` at `/insights`.
Mobile draws these in `react-native-svg`; on Web they become plain SVG, so the layout math ports
and the primitives are rewritten. Retire `SpendingInsights.tsx` and `ExpensePage.tsx`'s inline
charts.

### Phase 5 — Money Brain + Wrapped (M)
Money Brain as a right drawer over `/api/ai/chat`. Streaming is *easier* on Web: Mobile's
`src/api/ai.ts` only reaches for `expo/fetch` because Hermes can't read streaming bodies, so the
SSE frame parser ports and the transport shim drops out. Wire the existing `wrappedAdapter.ts` to
a real `/wrapped` route and replace the account placeholder card. Link chat from
`/account/chat-history`.

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
