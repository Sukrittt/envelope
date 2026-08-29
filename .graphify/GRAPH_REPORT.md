# Graph Report - .  (2026-08-29)

## Corpus Check
- 0 files · ~99,999 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 792 nodes · 1521 edges · 59 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.68)
- Token cost: 4,280 input · 4,120 output
- Edge kinds: contains: 576 · imports: 442 · imports_from: 274 · calls: 147 · conceptually_related_to: 26 · references: 13 · shares_data_with: 12 · implements: 5 · uses: 5 · includes: 4 · targets: 3 · queries: 2 · semantically_similar_to: 2 · applies: 1 · based_on: 1 · created_by: 1 · displays: 1 · enables: 1 · follows: 1 · inherits: 1 · provides_context: 1 · renders: 1 · specifies: 1

## God Nodes (most connected - your core abstractions)
1. `getAuth()` - 32 edges
2. `apiFetch()` - 32 edges
3. `json()` - 31 edges
4. `error()` - 26 edges
5. `getCollection()` - 21 edges
6. `readBody()` - 19 edges
7. `readOnlyGuard()` - 18 edges
8. `Mission Control` - 17 edges
9. `invalidate()` - 11 edges
10. `getWorkOSClient()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `SparkBars` --implements--> `Fluid Interactions`  [EXTRACTED]
  src/components/SparkBars.tsx → FLUID_INTERACTIONS.md
- `Heatmap` --implements--> `Fluid Interactions`  [EXTRACTED]
  src/components/SpendingInsights.tsx → FLUID_INTERACTIONS.md
- `SparkLine` --implements--> `Fluid Interactions`  [EXTRACTED]
  src/components/SparkLine.tsx → FLUID_INTERACTIONS.md
- `Plan 007: Heatmap Border Transition` --targets--> `Heatmap`  [EXTRACTED]
  plans/007-heatmap-day-border-transition.md → src/components/SpendingInsights.tsx
- `Plan 008: Tooltip Animation` --targets--> `Heatmap`  [EXTRACTED]
  plans/008-heatmap-tooltip-entrance.md → src/components/SpendingInsights.tsx

## Communities

### Community 0 - "Envelope Category Map"
Cohesion: 0.06
Nodes (35): buildCategoryMap(), cache, CategoryMap, CategoryMapOverride, getCachedCategoryMap(), invalidateCategoryMap(), assertRoundTrips(), decrypt() (+27 more)

### Community 1 - "Account Page & Theme"
Cohesion: 0.06
Nodes (32): NotifyCadence, UserDoc, AppearanceContext, AppearanceProvider(), AppearanceValue, Density, Theme, useAppearance() (+24 more)

### Community 2 - "Category Manager API"
Cohesion: 0.08
Nodes (39): Props, addBudget(), addCategory(), addGroup(), addHolding(), apiFetch(), BudgetRow, cancelSubscription() (+31 more)

### Community 3 - "Expense Context Models"
Cohesion: 0.08
Nodes (32): BudgetDocRow, CategoryDocRow, cycleMonths(), daysInMonth(), ExpenseRow, GroupDocRow, HoldingDocRow, lastNMonths() (+24 more)

### Community 4 - "API CRUD Route Handlers"
Cohesion: 0.12
Nodes (8): invalidateMock, invalidate(), error(), getCollection(), json(), readBody(), Session, SuggestResult

### Community 5 - "AI Chat Backend"
Cohesion: 0.09
Nodes (27): ChatSessionDoc, makeTitle(), StoredChatMessage, generateJSON(), getGeminiClient(), streamText(), buildSystemPrompt(), ClientMessage (+19 more)

### Community 6 - "Rate Limiting & Guards"
Cohesion: 0.11
Nodes (15): readOnlyGuard(), clientIp(), isRateLimited(), RateLimitHit, RateLimitTier, hits, displayName(), ensureUser() (+7 more)

### Community 7 - "Date Picker UI"
Cohesion: 0.08
Nodes (26): CategoryManager(), buildCells(), CalendarBody(), Cell, DatePicker(), DatePickerProps, fmt(), fmtShort() (+18 more)

### Community 8 - "Brief & Expense Context"
Cohesion: 0.12
Nodes (18): buildExpenseContext(), Brief, BriefCard, GET(), rateLimited(), Auth, cachedRead(), nowIST() (+10 more)

### Community 9 - "Rollover Banner UI"
Cohesion: 0.12
Nodes (21): MONTH_NAMES, monthLabel(), MonthRolloverBanner(), Props, FADE, MotionSheetProps, Scrim(), Sheet() (+13 more)

### Community 10 - "Data API Routes"
Cohesion: 0.12
Nodes (10): HEADERS, escapeRegExp(), BUDGET_HEADERS, CATEGORY_HEADERS, EXPENSE_HEADERS, GROUP_HEADERS, HOLDING_EVENT_HEADERS, HOLDING_HEADERS (+2 more)

### Community 11 - "Animation Plans & Docs"
Cohesion: 0.12
Nodes (17): Animation Plans (001-009), Apple Design Principles, DashboardProvider, fredoka, nunito, FitnessPage View, Fluid Interactions, Heatmap (+9 more)

### Community 12 - "Fluid Spark Charts"
Cohesion: 0.14
Nodes (13): FluidDemo(), smoothPath(), SparkBarDatum, SparkBars(), SparkBarsProps, CATEGORY_COLORS, ExpensePage(), formatCurrency() (+5 more)

### Community 13 - "Expense Entry Flow"
Cohesion: 0.18
Nodes (14): LogExpenseModal(), Props, toDateInputValue(), Props, addExpense(), getCategoryMap(), ensureMap(), fuzzyMatch() (+6 more)

### Community 14 - "Transactions Editing"
Cohesion: 0.14
Nodes (11): Props, TransactionEditModal(), CATEGORY_ICONS, INCOME_CATEGORIES, PeriodKey, TimelineItem, getBudgets(), updateExpense() (+3 more)

### Community 15 - "Envelope Compute Scripts"
Cohesion: 0.15
Nodes (15): budgets, capResult, categories, computeEnvelopes(), cycleMonths(), daysInMonth(), expenses, groups (+7 more)

### Community 16 - "Envelope Grid UI"
Cohesion: 0.18
Nodes (6): Props, EnvelopeGrid(), Props, Props, ReadyToAssignBanner(), formatCurrency()

### Community 17 - "OAuth Callbacks"
Cohesion: 0.26
Nodes (6): clearStateCookie(), generateNonce(), readCookie(), safeEqual(), setStateCookie(), verifyState()

### Community 18 - "Product Concepts"
Cohesion: 0.20
Nodes (11): subscriptions collection, Mission Control, Next.js 15 App Router, Onboarding Tour, Principle: Answer the money question in seconds, Route vs View Layer Split, Spending Insights, Subscriptions (+3 more)

### Community 19 - "Spending Insights Charts"
Cohesion: 0.25
Nodes (9): buildHeatmap(), buildReview(), DAY_HEADERS, fmt(), LEVEL_COLORS, monthLabel(), Props, SpendingInsights() (+1 more)

### Community 20 - "Auth Resolution"
Cohesion: 0.29
Nodes (8): bearerToken(), demoUserId(), getAuth(), getJwks(), readOnlyResponse(), verifyBearerToken(), isPlatform(), POST()

### Community 21 - "Budget & Holdings Concepts"
Cohesion: 0.22
Nodes (10): budgets collection, groups collection, holding_events collection, holdings collection, Envelope Budgeting, Fitness & Learnings Pages, INR Monthly Money Cycle, Investments (+2 more)

### Community 22 - "CSV Migration Scripts"
Cohesion: 0.29
Nodes (9): buildFilter(), COLLECTION_MAP, __dirname, __filename, main(), parseCsv(), readCsvAsObjects(), seedCollection() (+1 more)

### Community 23 - "Fitness Page"
Cohesion: 0.29
Nodes (9): capitalize(), DAY_TO_SPLIT, FitnessPage(), FitnessTab, formatDate(), getTodaySplit(), panel, SplitFilter (+1 more)

### Community 24 - "Account Security Concepts"
Cohesion: 0.28
Nodes (9): Account & Security, app/api Route Handlers, users collection, Read-only Demo Account, getAuth Resolver, middleware.ts Session Gating, ScopedCollection Choke Point, user_id Data Scoping (+1 more)

### Community 25 - "Expense CRUD Routes"
Cohesion: 0.36
Nodes (7): adjustCreditCardEnvelope(), DELETE(), ExpenseDoc, findExpense(), POST(), PUT(), notifyThresholdCrossed()

### Community 26 - "Wrapped Recap"
Cohesion: 0.31
Nodes (6): Row, computeWrapped(), DAY_NAMES, emptyWrapped(), WEEK_BUCKETS, WrappedData

### Community 27 - "User API Tests"
Cohesion: 0.22
Nodes (6): deleteManyMock, deleteUserMock, updateUserMock, usersDeleteOneMock, usersFindOneMock, usersUpdateOneMock

### Community 28 - "Architecture & Positioning"
Cohesion: 0.25
Nodes (8): budgets API, expenses API, Guest Demo Mode, Mission Control Dashboard, MongoDB, Next.js 15, Privacy by Design, Sukrit (User)

### Community 29 - "Collection CRUD Routes"
Cohesion: 0.29
Nodes (3): isDuplicateKeyError(), POST(), insertOneMock

### Community 30 - "Backfill Scripts"
Cohesion: 0.32
Nodes (7): APPLY, backfillCollection(), correctedTimestamp(), __dirname, __filename, main(), workspace

### Community 31 - "Notifications Concepts"
Cohesion: 0.29
Nodes (7): Auto-categorization, categories collection, notification_log collection, push_tokens collection, Google Gemini, Money Brain (AI), Push Notifications

### Community 32 - "Email Resend Tests"
Cohesion: 0.29
Nodes (5): isRateLimitedMock, listUsersMock, sendVerificationEmailMock, updateUserMock, usersUpdateOneMock

### Community 33 - "Notification Run Tests"
Cohesion: 0.29
Nodes (5): buildExpenseContextMock, logInsertOneMock, sendPushNotificationMock, USER, usersFindMock

### Community 34 - "Chat History UI"
Cohesion: 0.40
Nodes (3): ChatMessage, SessionDetail, SessionSummary

### Community 35 - "Middleware Gating"
Cohesion: 0.40
Nodes (5): config, CRON_PATHS, middleware(), PUBLIC_PAGE_PATHS, refreshSession

### Community 36 - "Instant Notif Tests"
Cohesion: 0.33
Nodes (5): buildExpenseContextMock, logInsertOneMock, sendPushNotificationMock, USER, usersFindOneMock

### Community 37 - "Onboarding UI"
Cohesion: 0.33
Nodes (3): fredoka, nunito, SLIDES

### Community 38 - "Security Page UI"
Cohesion: 0.33
Nodes (2): SessionRow, UserDoc

### Community 39 - "Account Layout"
Cohesion: 0.40
Nodes (3): fredoka, NAV, nunito

### Community 40 - "Data Export Page"
Cohesion: 0.50
Nodes (3): downloadBlob(), exportData(), Summary

### Community 41 - "Scoped Collection Tests"
Cohesion: 0.40
Nodes (2): Doc, stores

### Community 42 - "CSV Serialization"
Cohesion: 0.80
Nodes (3): csvField(), defangFormula(), toCsv()

### Community 43 - "Collection Mocks Tests"
Cohesion: 0.40
Nodes (2): Doc, store

### Community 44 - "Auth Layout"
Cohesion: 0.50
Nodes (2): fredoka, nunito

### Community 45 - "Update Route Tests"
Cohesion: 0.50
Nodes (2): Doc, invalidateMock

### Community 46 - "Self-hosting Principles"
Cohesion: 0.50
Nodes (4): CSV to MongoDB Migration, MongoDB Data Layer, Principle: Privacy by default, Principle: Self-hosted independence

### Community 47 - "Reorder Route Tests"
Cohesion: 0.50
Nodes (2): docs, invalidateMock

### Community 48 - "Move Route Tests"
Cohesion: 0.50
Nodes (2): isRateLimitedMock, sendVerificationEmailMock

### Community 49 - "AI Chat Tests"
Cohesion: 0.67
Nodes (2): FakeAuth, ModelContents

### Community 51 - "Expense & Transactions Concepts"
Cohesion: 0.67
Nodes (3): expenses collection, Principle: Direct manipulation over workflow, Transactions

### Community 52 - "Fitness Dashboard Spec"
Cohesion: 0.67
Nodes (3): Fitness Data Contract, Fitness KPI Definitions, Fitness Dashboard Specification

### Community 53 - "Invalidate Cache Tests"
Cohesion: 0.67
Nodes (2): docs, invalidateMock

### Community 54 - "Budget Loader Tests"
Cohesion: 0.67
Nodes (2): categories, groups

### Community 55 - "Sign-In Page"
Cohesion: 0.67
Nodes (1): metadata

### Community 57 - "ESLint Config"
Cohesion: 1.00
Nodes (1): compat

### Community 60 - "Next Config"
Cohesion: 1.00
Nodes (1): nextConfig

### Community 62 - "Mac Assistant"
Cohesion: 1.00
Nodes (1): Mac (Assistant)

### Community 63 - "Motion Library"
Cohesion: 1.00
Nodes (1): motion/react Library

## Knowledge Gaps
- **225 isolated node(s):** `Sukrit (User)`, `Next.js 15`, `Apple Design Principles`, `Spring Physics (motion/react)`, `Interruptibility` (+220 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Security Page UI`** (2 nodes): `SessionRow`, `UserDoc`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scoped Collection Tests`** (2 nodes): `Doc`, `stores`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Collection Mocks Tests`** (2 nodes): `Doc`, `store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Layout`** (2 nodes): `fredoka`, `nunito`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Update Route Tests`** (2 nodes): `Doc`, `invalidateMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reorder Route Tests`** (2 nodes): `docs`, `invalidateMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Move Route Tests`** (2 nodes): `isRateLimitedMock`, `sendVerificationEmailMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI Chat Tests`** (2 nodes): `FakeAuth`, `ModelContents`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Invalidate Cache Tests`** (2 nodes): `docs`, `invalidateMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Budget Loader Tests`** (2 nodes): `categories`, `groups`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sign-In Page`** (1 nodes): `metadata`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Config`** (1 nodes): `compat`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (1 nodes): `nextConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mac Assistant`** (1 nodes): `Mac (Assistant)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Motion Library`** (1 nodes): `motion/react Library`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getEffectiveDueDate()` connect `Expense Context Models` to `Date Picker UI`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `renewalDays()` connect `Expense Context Models` to `Date Picker UI`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `Fluid Interactions` connect `Animation Plans & Docs` to `Architecture & Positioning`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **What connects `Sukrit (User)`, `Next.js 15`, `Apple Design Principles` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Envelope Category Map` be split into smaller, more focused modules?**
  _Cohesion score 0.05593220338983051 - nodes in this community are weakly interconnected._
- **Should `Account Page & Theme` be split into smaller, more focused modules?**
  _Cohesion score 0.061170212765957445 - nodes in this community are weakly interconnected._
- **Should `Category Manager API` be split into smaller, more focused modules?**
  _Cohesion score 0.08048103607770583 - nodes in this community are weakly interconnected._