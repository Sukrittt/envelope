# Graph Report - .  (2026-09-21)

## Corpus Check
- Large corpus: 505 files · ~298,274 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 2373 nodes · 5257 edges · 156 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 1816 · imports: 1798 · imports_from: 1174 · calls: 362 · conceptually_related_to: 26 · rationale_for: 16 · references: 14 · shares_data_with: 12 · method: 8 · implements: 5 · includes: 4 · uses: 4 · targets: 3 · inherits: 2 · queries: 2 · semantically_similar_to: 2 · applies: 1 · based_on: 1 · created_by: 1 · displays: 1 · enables: 1 · follows: 1 · re_exports: 1 · renders: 1 · specifies: 1

## God Nodes (most connected - your core abstractions)
1. `json()` - 46 edges
2. `getAuth()` - 44 edges
3. `useCurrency()` - 44 edges
4. `error()` - 39 edges
5. `getDb()` - 36 edges
6. `getCollection()` - 33 edges
7. `requireAccess()` - 26 edges
8. `readOnlyGuard()` - 25 edges
9. `readBody()` - 25 edges
10. `UserDoc` - 23 edges

## Surprising Connections (you probably didn't know these)
- `SparkBars` --implements--> `Fluid Interactions`  [EXTRACTED]
  src/components/SparkBars.tsx → FLUID_INTERACTIONS.md
- `SparkLine` --implements--> `Fluid Interactions`  [EXTRACTED]
  src/components/SparkLine.tsx → FLUID_INTERACTIONS.md
- `Heatmap` --implements--> `Fluid Interactions`  [EXTRACTED]
  src/components/SpendingInsights.tsx → FLUID_INTERACTIONS.md
- `Plan 007: Heatmap Border Transition` --targets--> `Heatmap`  [EXTRACTED]
  plans/007-heatmap-day-border-transition.md → src/components/SpendingInsights.tsx
- `Plan 008: Tooltip Animation` --targets--> `Heatmap`  [EXTRACTED]
  plans/008-heatmap-tooltip-entrance.md → src/components/SpendingInsights.tsx

## Communities

### Community 0 - "Update Route Tests"
Cohesion: 0.05
Nodes (64): Action, ActionResult, SubmitButton(), fmtDate(), fmtDateTime(), timeAgo(), buildExpenseContext(), BillingFlags (+56 more)

### Community 1 - "Community 146"
Cohesion: 0.06
Nodes (33): ACTIONS, requireAccess(), ALLOWED_MIME_TYPES, BillItemInput, parseItems(), POST(), Brief, BriefCard (+25 more)

### Community 2 - "Account Page & Theme"
Cohesion: 0.06
Nodes (47): CurrencyPicker(), EnvelopeGrid(), Props, usedPct(), usedPctLabel(), ENVELOPE_SPRING, SpringChevron(), SpringCollapse() (+39 more)

### Community 3 - "Category Manager API"
Cohesion: 0.05
Nodes (45): BillScanDetail, BillScanItem, BillScanSummary, getBillScan(), getBillScans(), saveBillScan(), SaveBillScanParams, scanBill() (+37 more)

### Community 4 - "Expense Context Models"
Cohesion: 0.05
Nodes (37): buildSystemPrompt(), currencyInstruction(), createCurrencyFormat(), CURRENCIES, CurrencyCode, currencyInfo(), currencyPrefix(), formatMoney() (+29 more)

### Community 5 - "API CRUD Route Handlers"
Cohesion: 0.05
Nodes (38): Brief, BriefCard, ChatMessage, ChatSessionDetail, ChatSessionsPage, ChatSessionSummary, fetchBrief(), getChatSession() (+30 more)

### Community 6 - "Community 99"
Cohesion: 0.06
Nodes (44): DailyBars(), shortDay(), daysAgo(), fmtBytes(), lastNDays(), num(), parseRange(), RANGES (+36 more)

### Community 7 - "AI Chat Backend"
Cohesion: 0.06
Nodes (42): BudgetDocRow, CategoryDocRow, cycleMonths(), daysInMonth(), ExpenseRow, GroupDocRow, HoldingDocRow, lastNMonths() (+34 more)

### Community 8 - "Invalidate Cache Tests"
Cohesion: 0.07
Nodes (39): addBudget(), deleteBudget(), getBudgets(), mockedApiFetch, transferBudget(), updateBudget(), apiErrorMessage(), apiFetch() (+31 more)

### Community 9 - "Community 143"
Cohesion: 0.05
Nodes (26): Doc, stores, Doc, store, Auth, invalidate(), casRetry(), createExpense() (+18 more)

### Community 10 - "IST Time Script"
Cohesion: 0.09
Nodes (26): HEADERS, EXT_BY_MIME, getBillScanImageUrl(), storeBillScanImage(), cachedRead(), buildAndStoreExport(), countReadyExportsThisMonth(), currentMonthKey() (+18 more)

### Community 11 - "Animation Plans & Docs"
Cohesion: 0.08
Nodes (22): AdminNav(), NAV, metadata, BirdMark(), ExpensePageLoading(), ExpenseSidebar(), FluidDemo(), smoothPath() (+14 more)

### Community 12 - "Envelope Grid UI"
Cohesion: 0.13
Nodes (22): BillingStatus, getBillingStatus(), syncBilling(), billingVisible(), formatDate(), lockedReason(), planSummary(), REMINDER_DAYS (+14 more)

### Community 13 - "Date Picker UI"
Cohesion: 0.13
Nodes (19): addCategory(), deleteCategory(), getCategories(), moveCategory(), mockedApiFetch, updateCategory(), addGroup(), deleteGroup() (+11 more)

### Community 14 - "Date Picker UI"
Cohesion: 0.09
Nodes (22): AlertThresholdPicker(), Props, EnvelopeTabbar(), TABS, FADE, MotionSheetProps, Scrim(), Sheet() (+14 more)

### Community 15 - "Community 97"
Cohesion: 0.10
Nodes (18): CategoryPicker(), plainKey(), Props, rankCategories(), state, useCategories(), useExpenses(), useGroups() (+10 more)

### Community 16 - "Backfill Scripts"
Cohesion: 0.10
Nodes (15): Props, TransactionEditModal(), CATEGORY_ICONS, INCOME_CATEGORIES, PeriodKey, TimelineItem, CATEGORY_COLORS, getCategoryColor() (+7 more)

### Community 17 - "Product Concepts"
Cohesion: 0.07
Nodes (25): CheckIcon(), elevation, PHONE, radius, springTight, ActivityGlyph, box, disc (+17 more)

### Community 18 - "Reorder Route Tests"
Cohesion: 0.11
Nodes (18): getCategoryMap(), suggestCategoryLLM(), llmAnswers, LogExpenseModal(), offsetDateValue(), Props, llm, toDateInputValue() (+10 more)

### Community 19 - "Spending Insights Charts"
Cohesion: 0.08
Nodes (14): updateUser(), completeOnboarding(), COLORS, Confetti(), defaultCats(), EMOJI_CYCLE, fredoka, Item (+6 more)

### Community 20 - "Auth Resolution"
Cohesion: 0.09
Nodes (18): AssignMoneyScreen(), CARD_SPRING, cents(), EditAssignedBody(), EditAssignedScreen(), EditReadyToAssignScreen(), FADE_IN, FADE_OUT (+10 more)

### Community 21 - "Rate Limiting & Guards"
Cohesion: 0.13
Nodes (19): Access, AccessInput, AccessMode, ENTITLING, pickSubscription(), resolveAccess(), subscriptionEntitles(), NOW (+11 more)

### Community 22 - "Budget & Holdings Concepts"
Cohesion: 0.13
Nodes (14): EMPTY_SET, useCollapsedGroups(), useDismissedRolloverBanner(), usePersistentState(), useRecentCategories(), clearLocalPrefs(), KEEP_ON_LOGOUT, listeners (+6 more)

### Community 23 - "CSV Migration Scripts"
Cohesion: 0.09
Nodes (19): BreakdownRow, breakdownRows(), CATEGORIES, DemoCategory, GROUPS, WORDS, arcPath(), buildDonutTransition() (+11 more)

### Community 24 - "Fitness Page"
Cohesion: 0.08
Nodes (17): getHoldingEvents(), useHoldingEvents(), useDeleteHolding(), useHoldings(), usePerformHoldingAction(), useUpdateHolding(), HoldingRow, ACTION_COPY (+9 more)

### Community 25 - "Account Security Concepts"
Cohesion: 0.18
Nodes (20): addRecurringExpense(), deleteRecurringExpense(), failure(), getRecurringExpenses(), pauseRecurringExpense(), RecurringExpenseInput, resumeRecurringExpense(), updateRecurringExpense() (+12 more)

### Community 26 - "Expense CRUD Routes"
Cohesion: 0.11
Nodes (14): fredoka, NAV, nunito, useAppearance(), SignOutDialog(), NAV, Props, openMoneyBrain (+6 more)

### Community 27 - "Wrapped Recap"
Cohesion: 0.14
Nodes (18): amountFor(), collisionFilter(), extraInvalidations(), GET(), labelFor(), listArchive(), POST(), ARCHIVABLE_COLLECTIONS (+10 more)

### Community 28 - "Architecture & Positioning"
Cohesion: 0.14
Nodes (20): app/api/expenses/concurrency.test.ts, controls, request(), seed(), adjustCreditCardEnvelope(), checkExpense(), DELETE(), ExpenseDoc (+12 more)

### Community 29 - "Expense Entry Flow"
Cohesion: 0.14
Nodes (15): ActionForm(), aiAllowanceResponse(), monthlySpendUsd(), monthStart(), spendCache, pickCategory(), aiDisabledResponse(), DEFAULTS (+7 more)

### Community 30 - "Collection CRUD Routes"
Cohesion: 0.13
Nodes (17): BudgetNum, computeEnvelopeState(), currentMonthKey(), EnvelopeState, ExpenseNum, incomeForReadyToAssign(), lastSpentByCategory(), MONTH_NAMES (+9 more)

### Community 31 - "Notifications Concepts"
Cohesion: 0.13
Nodes (18): CATEGORY_EMOJI, categoryEmoji(), GROUP_EMOJI, groupEmoji(), splitEmoji(), Envelope, toEnvelope(), EnvelopeRow() (+10 more)

### Community 32 - "Email Resend Tests"
Cohesion: 0.12
Nodes (14): fredoka, metadata, nunito, viewport, AppearanceProvider(), AppShell(), pageMeta, ClientProviders() (+6 more)

### Community 33 - "Notification Run Tests"
Cohesion: 0.13
Nodes (19): buildCells(), CalendarBody(), Cell, DatePicker(), DatePickerProps, fmt(), fmtShort(), key() (+11 more)

### Community 34 - "Chat History UI"
Cohesion: 0.13
Nodes (17): formatDateTimeLong(), Numpad(), space, AnimatedUsedPercentage(), clamp(), colorStops(), DELTA_EASE, DeltaBar() (+9 more)

### Community 35 - "Middleware Gating"
Cohesion: 0.20
Nodes (17): count_bullets(), extract_code_blocks(), extract_headings(), extract_inline_codes(), extract_paths(), extract_urls(), Line-based fenced code block extractor.      Handles ``` and ~~~ fences with var, Backtick-delimited inline spans, with fenced code blocks stripped first.      Pr (+9 more)

### Community 36 - "Instant Notif Tests"
Cohesion: 0.13
Nodes (14): ArchivableCollection, ArchivedItem, getArchive(), restoreArchivedItem(), ConfirmDialog(), daysUntil(), archiveKey, ArchivePage() (+6 more)

### Community 37 - "Budget Loader Tests"
Cohesion: 0.15
Nodes (14): diagnostics(), FeedbackType, submitFeedback(), MONTH_NAMES, monthLabel(), MonthRolloverBanner(), Props, ButtonPhase (+6 more)

### Community 38 - "Onboarding UI"
Cohesion: 0.10
Nodes (15): ENTER, NAV_LABEL, Screen, Tab, TAB_OF, TABS, TRANSITION, Z (+7 more)

### Community 39 - "Security Page UI"
Cohesion: 0.16
Nodes (13): args(), loadEnv(), USER_COLLECTIONS, client, DRY, DRY, main(), opts (+5 more)

### Community 40 - "Account Layout"
Cohesion: 0.16
Nodes (19): backup_dir_for(), build_compress_prompt(), build_fix_prompt(), call_claude(), compress_file(), first_nonblank_line(), is_sensitive_path(), Strip outer ```markdown ... ``` fence when it wraps the entire output. (+11 more)

### Community 41 - "Data Export Page"
Cohesion: 0.14
Nodes (18): buildExpensePanel(), dataBudgetsPath, dataExpensesPath, __dirname, ESSENTIAL_CATEGORIES, expensePanelPaths, __filename, formatCsv() (+10 more)

### Community 42 - "Collection Mocks Tests"
Cohesion: 0.15
Nodes (12): getIdentityProviders(), getPrivacyProof(), getSessions(), restoreAccount(), UserProfile, identitiesKey, privacyProofKey, sessionsKey (+4 more)

### Community 43 - "Auth Layout"
Cohesion: 0.14
Nodes (9): changeEmail(), ExportRow, ExportsResponse, getExports(), PrivacyProof, purgeArchivedItem(), SessionRow, startExport() (+1 more)

### Community 44 - "Scoped Collection Tests"
Cohesion: 0.25
Nodes (14): addSubscription(), cancelSubscription(), deleteSubscription(), getSubscriptions(), reactivateSubscription(), updateSubscription(), briefKey, subscriptionsKey (+6 more)

### Community 45 - "Self-hosting Principles"
Cohesion: 0.21
Nodes (12): initialLesson(), Job, JOBS, LessonAction, lessonReducer(), LessonState, remaining(), Snapshot (+4 more)

### Community 46 - "Transactions Editing"
Cohesion: 0.21
Nodes (12): ChatSessionDoc, makeTitle(), StoredChatMessage, ClientMessage, handleDemo(), handlePersisted(), isValidMessages(), ModelContents (+4 more)

### Community 47 - "CSV Serialization"
Cohesion: 0.18
Nodes (12): Heatmap(), HeatmapCell, heatmapLevels(), LABELS, LEVEL_OPACITY, Props, Props, TrendChart() (+4 more)

### Community 48 - "Envelope Compute Scripts"
Cohesion: 0.16
Nodes (15): BILLING_CYCLES, BillingCycle, CYCLE_LABEL, CYCLE_NOUN, firstOfNextMonth(), formatDueDate(), futureDate(), Props (+7 more)

### Community 49 - "Move Route Tests"
Cohesion: 0.15
Nodes (15): budgets, capResult, categories, computeEnvelopes(), cycleMonths(), daysInMonth(), expenses, groups (+7 more)

### Community 50 - "Rate Limiting & Guards"
Cohesion: 0.24
Nodes (13): accessEndedAt(), addMonthsUtc(), isLive(), noticeTier(), notifyOnce(), plural(), RETENTION_NOTICE_DAYS, RetentionResult (+5 more)

### Community 51 - "Rate Limiting & Guards"
Cohesion: 0.23
Nodes (12): date(), latest(), ProjectedSubscription, projectSubscriber(), statusOf(), iso(), NOW, subscriber() (+4 more)

### Community 52 - "AI Chat Tests"
Cohesion: 0.16
Nodes (10): AllocationBar(), AllocationSegment, BRAND_COLORS, chargeLabel(), daysTo(), Props, Subscription, SubscriptionsPanel() (+2 more)

### Community 53 - "Magic Code Page"
Cohesion: 0.14
Nodes (13): BottomSheet(), Button(), Chip(), cssEase(), Digit(), isDigit(), lastSeen, PAD_KEYS (+5 more)

### Community 54 - "Expense & Transactions Concepts"
Cohesion: 0.17
Nodes (12): arcPath(), buildDonutTransition(), DonutArcLayout, DonutArcTransition, DonutChart(), DonutSegment, layoutDonutSegments(), lerp() (+4 more)

### Community 55 - "ESLint Config"
Cohesion: 0.19
Nodes (11): EXTRA_USER_COLLECTIONS, purgeAccountNow(), restoreAccount(), softDeleteAccount(), isValidTimezone(), nowIn(), nowIST(), zoneParts() (+3 more)

### Community 56 - "Fitness Dashboard Spec"
Cohesion: 0.28
Nodes (12): categoryBreakdown(), categorySpendInMonth(), fixedCategories(), isExcluded(), leftoverFor(), MonthComparison, monthRange(), monthTotals() (+4 more)

### Community 57 - "Sign-In Page"
Cohesion: 0.23
Nodes (8): addHolding(), deleteHolding(), getHoldings(), performHoldingAction(), updateHolding(), eventsKey, key, useAddHolding()

### Community 58 - "Rate Limiting & Guards"
Cohesion: 0.19
Nodes (10): billingFlagsFor(), BillingEventDoc, fetchSubscriber(), RevenueCatError, secretKey(), getAccess(), refreshFromProvider(), POST() (+2 more)

### Community 59 - "Email Page"
Cohesion: 0.15
Nodes (14): expenses collection, subscriptions collection, Mission Control, Next.js 15 App Router, Onboarding Tour, Principle: Answer the money question in seconds, Principle: Direct manipulation over workflow, Route vs View Layer Split (+6 more)

### Community 60 - "Help Page"
Cohesion: 0.20
Nodes (11): bearerToken(), getJwks(), verifyBearerToken(), APP_PATHS, config, CRON_PATHS, isAppPath(), middleware() (+3 more)

### Community 61 - "Misc API Route"
Cohesion: 0.29
Nodes (12): addMonths(), advance(), firstRunOnOrAfter(), FREQUENCIES, Frequency, isExpired(), iso(), lastDayOfMonth() (+4 more)

### Community 62 - "Mac Assistant"
Cohesion: 0.29
Nodes (9): nowIST(), todayIST(), toISTDateString(), Envelope, FillTone, lastSpentLabel(), SHORT_MONTHS, usedPct() (+1 more)

### Community 63 - "Motion Library"
Cohesion: 0.18
Nodes (7): NOTIFY_OPTIONS, NotifyCadence, THEME_OPTIONS, Tone, UserDoc, CurrencySetting(), useHideAmounts()

### Community 64 - "Vitest Config"
Cohesion: 0.24
Nodes (7): metadata, Faq(), LandingMotion(), MoneyLesson(), Playground(), FAQS, LandingPage()

### Community 65 - "Vitest Setup"
Cohesion: 0.20
Nodes (7): CategoryBreakdown(), LIST_SPRING, Props, useReveal(), BreakdownRow, AutoHeight(), PopIn()

### Community 66 - "Community 66"
Cohesion: 0.22
Nodes (7): ChatMessage, SessionDetail, SessionSummary, MoneyBrainContext, MoneyBrainContextValue, MoneyBrainProvider(), useMoneyBrain()

### Community 67 - "Community 67"
Cohesion: 0.18
Nodes (5): AppearanceContext, AppearanceValue, Density, Theme, ThemePreference

### Community 68 - "User API Tests"
Cohesion: 0.29
Nodes (6): clearStateCookie(), generateNonce(), readCookie(), safeEqual(), setStateCookie(), verifyState()

### Community 69 - "Community 68"
Cohesion: 0.22
Nodes (4): fieldAad(), fieldsFor(), Doc, ScopeOpts

### Community 70 - "Community 69"
Cohesion: 0.25
Nodes (10): detect_file_type(), _is_code_line(), _is_json_content(), _is_yaml_content(), Return True if the file is natural language and should be compressed., Check if a line looks like code., Check if content is valid JSON., Heuristic: check if content looks like YAML. (+2 more)

### Community 71 - "Community 70"
Cohesion: 0.24
Nodes (10): Animation Plans (001-009), Apple Design Principles, Fluid Interactions, Heatmap, Interruptibility, Plan 007: Heatmap Border Transition, Plan 008: Tooltip Animation, Plan 009: SparkLine Fill (+2 more)

### Community 72 - "Community 145"
Cohesion: 0.20
Nodes (7): claimed, getAccess, NOW, purgeAccountNow, refreshFromProvider, sendPushNotification, settings

### Community 73 - "Community 71"
Cohesion: 0.22
Nodes (10): budgets collection, groups collection, holding_events collection, holdings collection, Envelope Budgeting, Fitness & Learnings Pages, INR Monthly Money Cycle, Investments (+2 more)

### Community 74 - "Community 72"
Cohesion: 0.27
Nodes (6): RecurringExpenseModal(), CHART_COLORS, CADENCE_LABELS, dueLabel(), monthlyEquivalent(), RecurringPage()

### Community 75 - "Community 73"
Cohesion: 0.29
Nodes (9): buildFilter(), COLLECTION_MAP, __dirname, __filename, main(), parseCsv(), readCsvAsObjects(), seedCollection() (+1 more)

### Community 76 - "Community 74"
Cohesion: 0.20
Nodes (7): completeOnboardingMock, deleteManyMock, deleteUserMock, updateUserMock, usersDeleteOneMock, usersFindOneMock, usersUpdateOneMock

### Community 77 - "Community 75"
Cohesion: 0.28
Nodes (9): Account & Security, app/api Route Handlers, users collection, Read-only Demo Account, getAuth Resolver, middleware.ts Session Gating, ScopedCollection Choke Point, user_id Data Scoping (+1 more)

### Community 78 - "Community 76"
Cohesion: 0.31
Nodes (6): ENCRYPTED_FIELDS, buildUpdate(), main(), migrateCollection(), BuildUpdate, verifyCollection()

### Community 79 - "Community 77"
Cohesion: 0.42
Nodes (7): dayMatches(), isDueToday(), isDueTomorrow(), lastDayOfMonth(), RecurringHolding, base, tomorrowOf()

### Community 80 - "Brief & Expense Context"
Cohesion: 0.31
Nodes (6): Row, computeWrapped(), DAY_NAMES, emptyWrapped(), WEEK_BUCKETS, WrappedData

### Community 81 - "Community 80"
Cohesion: 0.22
Nodes (6): buildExpenseContextMock, logInsertOneMock, sendPushNotificationMock, thresholdFindOneAndUpdateMock, USER, usersFindMock

### Community 82 - "Community 88"
Cohesion: 0.25
Nodes (5): billingDeleteOneMock, deleteManyMocks, deleteUserMock, usersDeleteOneMock, usersFindMock

### Community 83 - "Community 81"
Cohesion: 0.25
Nodes (6): auditMock, findOneMock, purgeMock, redirectMock, requireAdminMock, softDeleteMock

### Community 84 - "Community 82"
Cohesion: 0.25
Nodes (7): buildExpenseContextMock, logInsertOneMock, sendPushNotificationMock, thresholdStateFindOneAndUpdateMock, thresholdStateStore, USER, usersFindOneMock

### Community 85 - "Community 83"
Cohesion: 0.32
Nodes (7): APPLY, backfillCollection(), correctedTimestamp(), __dirname, __filename, main(), workspace

### Community 86 - "Community 84"
Cohesion: 0.29
Nodes (5): daysUntil(), ProofDoc, SecurityContent(), SessionRow, UserDoc

### Community 87 - "Community 85"
Cohesion: 0.29
Nodes (7): Auto-categorization, categories collection, notification_log collection, push_tokens collection, Google Gemini, Money Brain (AI), Push Notifications

### Community 88 - "Community 86"
Cohesion: 0.29
Nodes (5): auth, Doc, queuedAfter, store, storeBillScanImage

### Community 89 - "Community 87"
Cohesion: 0.29
Nodes (5): isRateLimitedMock, listUsersMock, sendVerificationEmailMock, updateUserMock, usersUpdateOneMock

### Community 90 - "Community 89"
Cohesion: 0.48
Nodes (5): assertRoundTrips(), decrypt(), encrypt(), getKey(), keys

### Community 91 - "Community 90"
Cohesion: 0.29
Nodes (4): Doc, put, sendPushNotification, stores

### Community 92 - "Community 91"
Cohesion: 0.29
Nodes (5): mockGenerateJSONFromImage, mockGetAuth, mockIsRateLimited, mockReadOnlyGuard, validBody

### Community 93 - "Community 145"
Cohesion: 0.33
Nodes (4): caller, evaluate, logMock, usage

### Community 94 - "Community 92"
Cohesion: 0.33
Nodes (3): API_DIR, OPEN, routes

### Community 95 - "Community 93"
Cohesion: 0.33
Nodes (4): getAuthMock, isRateLimitedMock, readOnlyGuardMock, validBody

### Community 96 - "Community 94"
Cohesion: 0.33
Nodes (6): Guest Demo Mode, Mission Control Dashboard, MongoDB, Next.js 15, Privacy by Design, Sukrit (User)

### Community 97 - "Community 95"
Cohesion: 0.33
Nodes (3): Doc, notifyThresholdCrossed, stores

### Community 98 - "Community 96"
Cohesion: 0.33
Nodes (3): isEncrypted(), Call, StoredDoc

### Community 99 - "Community 98"
Cohesion: 0.33
Nodes (5): argv, client, DRY, endsAt, startedAt

### Community 100 - "Community 145"
Cohesion: 0.40
Nodes (4): aggregateMock, NOW, settings, user

### Community 101 - "Community 100"
Cohesion: 0.60
Nodes (2): getUser(), CurrencyProvider()

### Community 102 - "Wrapped Recap"
Cohesion: 0.40
Nodes (2): Doc, stores

### Community 103 - "Community 101"
Cohesion: 0.40
Nodes (4): findOne, OFF, ON, settings

### Community 104 - "Community 102"
Cohesion: 0.40
Nodes (4): demo, getAccessMock, getSystemSettingsMock, user

### Community 105 - "Community 145"
Cohesion: 0.60
Nodes (2): ExpenseNoticeDialog(), expenseNotice()

### Community 106 - "Community 103"
Cohesion: 0.40
Nodes (3): expired, useBillingStatusMock, usePathnameMock

### Community 107 - "Community 104"
Cohesion: 0.40
Nodes (4): auth, Doc, getExportDownloadUrl, store

### Community 108 - "Community 105"
Cohesion: 0.40
Nodes (3): fredoka, nunito, SparkBars

### Community 109 - "Community 106"
Cohesion: 0.40
Nodes (2): EMPTY_SET, useTourProgress()

### Community 110 - "Community 107"
Cohesion: 0.40
Nodes (4): db, deleteManyMock, deleteOneMock, deleteUserMock

### Community 111 - "Community 108"
Cohesion: 0.40
Nodes (4): budgetsFindOne, eventsInsertOne, holdingsFindOne, holdingsUpdateOne

### Community 112 - "Fluid Spark Charts"
Cohesion: 0.40
Nodes (3): lastTouched, updateOneMock, touchLastSeen()

### Community 113 - "Community 109"
Cohesion: 0.70
Nodes (4): benchmark_pair(), count_tokens(), main(), print_table()

### Community 114 - "Community 110"
Cohesion: 0.40
Nodes (2): Doc, store

### Community 115 - "Community 111"
Cohesion: 0.40
Nodes (2): Doc, store

### Community 116 - "Community 112"
Cohesion: 0.50
Nodes (2): fredoka, nunito

### Community 117 - "Community 113"
Cohesion: 0.50
Nodes (2): Doc, invalidateMock

### Community 118 - "Community 114"
Cohesion: 0.50
Nodes (4): CSV to MongoDB Migration, MongoDB Data Layer, Principle: Privacy by default, Principle: Self-hosted independence

### Community 119 - "Community 115"
Cohesion: 0.50
Nodes (3): auth, Doc, getBillScanImageUrl

### Community 120 - "Community 116"
Cohesion: 0.50
Nodes (2): Doc, store

### Community 121 - "Community 117"
Cohesion: 0.50
Nodes (1): Doc

### Community 122 - "Community 118"
Cohesion: 0.50
Nodes (2): docs, invalidateMock

### Community 123 - "Community 119"
Cohesion: 0.50
Nodes (2): isRateLimitedMock, sendVerificationEmailMock

### Community 124 - "Community 120"
Cohesion: 0.50
Nodes (3): restoreMock, usersFindOneMock, usersUpdateOneMock

### Community 125 - "Community 121"
Cohesion: 0.50
Nodes (2): INDEXES, LIVE_ONLY

### Community 126 - "Community 145"
Cohesion: 0.67
Nodes (3): CategoryManager.tsx, expense-redesign.css, updateCategory

### Community 127 - "Community 122"
Cohesion: 0.67
Nodes (2): FakeAuth, ModelContents

### Community 128 - "Community 123"
Cohesion: 0.67
Nodes (2): invalidateCategoryMapMock, invalidateMock

### Community 130 - "Community 125"
Cohesion: 0.67
Nodes (1): metadata

### Community 131 - "Community 126"
Cohesion: 0.67
Nodes (3): Fitness Data Contract, Fitness KPI Definitions, Fitness Dashboard Specification

### Community 132 - "Expense Entry Flow"
Cohesion: 0.67
Nodes (2): findOneMock, withAuthMock

### Community 133 - "Expense Entry Flow"
Cohesion: 0.67
Nodes (2): findOneMock, getDbMock

### Community 134 - "Community 127"
Cohesion: 0.67
Nodes (2): docs, invalidateMock

### Community 135 - "Community 128"
Cohesion: 0.67
Nodes (1): metadata

### Community 136 - "Community 129"
Cohesion: 1.00
Nodes (2): main(), print_usage()

### Community 137 - "Community 130"
Cohesion: 1.00
Nodes (2): fetchAllUsers(), main()

### Community 138 - "Community 131"
Cohesion: 0.67
Nodes (1): metadata

### Community 140 - "Community 145"
Cohesion: 1.00
Nodes (1): { remove }

### Community 142 - "Community 134"
Cohesion: 1.00
Nodes (1): compat

### Community 145 - "Community 139"
Cohesion: 1.00
Nodes (1): stylesheet

### Community 147 - "Community 141"
Cohesion: 1.00
Nodes (1): nextConfig

### Community 150 - "Community 145"
Cohesion: 1.00
Nodes (1): Caveman compress scripts.  This package provides tools to compress natural langu

### Community 152 - "Community 145"
Cohesion: 1.00
Nodes (1): app/api/budgets/route.ts

### Community 153 - "Community 145"
Cohesion: 1.00
Nodes (1): app/api/budgets/transfer/route.ts

### Community 154 - "Community 145"
Cohesion: 1.00
Nodes (1): app/api/categories/reorder/route.ts

### Community 155 - "Community 145"
Cohesion: 1.00
Nodes (1): app/api/categories/route.ts

### Community 156 - "Community 145"
Cohesion: 1.00
Nodes (1): lib/createExpense.ts

### Community 157 - "Community 145"
Cohesion: 1.00
Nodes (1): plans/expense-write-concurrency.md

### Community 158 - "Community 145"
Cohesion: 1.00
Nodes (1): lib/holdings.ts

### Community 159 - "Community 145"
Cohesion: 1.00
Nodes (1): app/api/holdings/route.ts

### Community 160 - "Community 148"
Cohesion: 1.00
Nodes (1): Mac (Assistant)

### Community 161 - "Community 145"
Cohesion: 1.00
Nodes (1): lib/mongodb.ts

### Community 162 - "Community 149"
Cohesion: 1.00
Nodes (1): motion/react Library

### Community 164 - "Community 145"
Cohesion: 1.00
Nodes (1): app/api/notifications/run/route.ts

### Community 165 - "Community 145"
Cohesion: 1.00
Nodes (1): lib/scoped.ts

## Knowledge Gaps
- **624 isolated node(s):** `Caveman compress scripts.  This package provides tools to compress natural langu`, `Split YAML frontmatter from body. Returns (frontmatter, body).      Memory files`, `Resolve the out-of-tree backup directory for a given source file.      Backups m`, `Heuristic denylist for files that must never be shipped to a third-party API.`, `Strip outer ```markdown ... ``` fence when it wraps the entire output.` (+619 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 100`** (2 nodes): `getUser()`, `CurrencyProvider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Wrapped Recap`** (2 nodes): `Doc`, `stores`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (2 nodes): `ExpenseNoticeDialog()`, `expenseNotice()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 106`** (2 nodes): `EMPTY_SET`, `useTourProgress()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 110`** (2 nodes): `Doc`, `store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 111`** (2 nodes): `Doc`, `store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 112`** (2 nodes): `fredoka`, `nunito`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 113`** (2 nodes): `Doc`, `invalidateMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 116`** (2 nodes): `Doc`, `store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 117`** (1 nodes): `Doc`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 118`** (2 nodes): `docs`, `invalidateMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 119`** (2 nodes): `isRateLimitedMock`, `sendVerificationEmailMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 121`** (2 nodes): `INDEXES`, `LIVE_ONLY`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 122`** (2 nodes): `FakeAuth`, `ModelContents`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 123`** (2 nodes): `invalidateCategoryMapMock`, `invalidateMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 125`** (1 nodes): `metadata`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expense Entry Flow`** (2 nodes): `findOneMock`, `withAuthMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expense Entry Flow`** (2 nodes): `findOneMock`, `getDbMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 127`** (2 nodes): `docs`, `invalidateMock`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 128`** (1 nodes): `metadata`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 129`** (2 nodes): `main()`, `print_usage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 130`** (2 nodes): `fetchAllUsers()`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 131`** (1 nodes): `metadata`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `{ remove }`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 134`** (1 nodes): `compat`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 139`** (1 nodes): `stylesheet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 141`** (1 nodes): `nextConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `Caveman compress scripts.  This package provides tools to compress natural langu`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `app/api/budgets/route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `app/api/budgets/transfer/route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `app/api/categories/reorder/route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `app/api/categories/route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `lib/createExpense.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `plans/expense-write-concurrency.md`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `lib/holdings.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `app/api/holdings/route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 148`** (1 nodes): `Mac (Assistant)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `lib/mongodb.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 149`** (1 nodes): `motion/react Library`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `app/api/notifications/run/route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `lib/scoped.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useCurrency()` connect `Community 2` to `Community 65`, `Community 47`, `Community 7`, `Community 4`, `Community 101`, `Community 18`, `Community 5`, `Community 20`, `Community 37`, `Community 14`, `Community 25`, `Community 3`, `Community 48`, `Community 52`, `Community 16`, `Community 45`, `Community 38`, `Community 23`, `Community 53`, `Community 34`, `Community 19`, `Community 36`, `Community 11`, `Community 24`, `Community 74`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `Mission Control Dashboard` connect `Community 96` to `Community 73`, `Community 71`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `MongoDB` connect `Community 96` to `Community 8`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `Caveman compress scripts.  This package provides tools to compress natural langu`, `Split YAML frontmatter from body. Returns (frontmatter, body).      Memory files`, `Resolve the out-of-tree backup directory for a given source file.      Backups m` to the rest of the system?**
  _624 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04968047825190682 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05777491408934708 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05974124809741248 - nodes in this community are weakly interconnected._