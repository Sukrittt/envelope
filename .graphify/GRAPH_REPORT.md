# Mission Control Dashboard — Knowledge Graph Report

## Overview

**Corpus:** 115 files · ~57K words
- Code: 83 files (.ts, .tsx, .mjs)
- Docs: 24 files (.md)
- Images: 6 files

**Graph:** 29 nodes · 27 edges · 4 communities

---

## God Nodes (Highest Influence)

1. **Mission Control Dashboard** (degree: 8)
   - Central hub connecting all subsystems
   - Anchors: financial envelope budgeting, fluid interactions design, privacy-first architecture, guest demo mode

2. **Fluid Interactions** (degree: 5)
   - Design system spanning animation, motion library, spring physics, interruptibility
   - Surfaces: SparkBars, Heatmap, SparkLine components
   - Drives: Plans 007–009 animation improvements

3. **Next.js 15 + MongoDB** (degree: 3 each)
   - Technology choices enabling layered architecture and persistent data model

---

## Communities

### Community 0: Product & User Model (Sukrit)
- **Mission Control Dashboard**, Sukrit (user), envelope budgeting, privacy, guest demo mode, Mac (assistant)
- Focus: Financial cockpit, user-centered design, data ownership

### Community 1: Technology Stack
- **Next.js 15**, **MongoDB**, DashboardProvider, expenses/budgets APIs
- Focus: Backend infrastructure, data persistence, server-side request handling

### Community 2: Interaction & Animation Design
- **Fluid Interactions**, Apple design principles, spring physics, interruptibility
- Components: SparkBars, Heatmap, SparkLine
- Plans: 007 (heatmap border), 008 (tooltip), 009 (sparkline fill)
- Focus: Motion-driven UX, Apple-like responsiveness, GPU-friendly animations

### Community 3: Fitness Dashboard (Emerging)
- **Fitness Dashboard Spec**, Data Contract, KPI Definitions
- FitnessPage view integrates SparkLine
- Status: Experiment on bundled sample data; not wired to real backend yet

---

## Surprising Connections

1. **Heatmap ← Plan 008 ← Fitness Dashboard**
   - Plan 008 animates tooltip in SpendingInsights heatmap
   - Same heatmap design pattern appears in fitness dashboard (calendar view)
   - Implication: Fitness dashboard could reuse tooltip animation work without duplicating motion logic

2. **SparkBars ← Interruptibility ← Spring Physics**
   - Core strength of fluid interactions (velocity handoff + interruptibility)
   - Plans 001–009 incrementally refine animation delivery without regressions
   - Hidden coupling: all 9 animation plans assume motion library availability; migration would block entire animation roadmap

3. **Privacy Principle ← Guest Demo Mode ← API Scope Model**
   - Three-layer isolation: auth token → scope (real/guest) → collection routing
   - Single point of failure: if scope resolution breaks, demos leak real financial data
   - Opportunity: audit guestWriteGuard implementation in every mutation route

---

## Suggested Questions

1. **What animation improvements have been completed, and what's the next priority?**
   - Graph traversal would show: plans 001–006 DONE (via commit f481763), 007–009 DONE (via commit 59ce0d4)
   - Only 003 (token consolidation) remains, pending decision

2. **How is the fitness dashboard evolving, and what dependencies does it have on shared components?**
   - Fitness dashboard (community 3) currently isolated with bundled sample data
   - Could expose SparkLine reuse opportunity (already uses it for weight/protein trends)
   - Data contract ready; needs real data integration + settlement of KPI formulas

3. **Which components implement fluid interactions, and are there motion-debt risks?**
   - SparkBars, Heatmap, SparkLine all use motion/react + spring physics
   - High-risk areas: animation cleanup on unmount, interruptibility during route transitions, reduced-motion fallback coverage
   - Cross-cutting concern: all 9 plans rely on same motion tokens (--ease-standard, --dur-fast, --dur-med)

4. **What prevents the guest demo from leaking real data?**
   - Auth scope model creates guest scope via Bearer token check
   - Collections hardcoded to demo_* collection names on guest scope
   - Risk point: if a route forgets to call guestWriteGuard, mutations on guest scope write to demo collections (read-only, but misleading behavior)

---

## Structural Notes

- **Temporal markers:** Plans 007–009 delivered in commit f481763 (Mar 11); all animation audit (001–006) completed earlier
- **Architecture split:** app/ (routing) ↔ src/ (views/components/context/services) ↔ lib/ (server helpers) — enforced separation means mutations on app/api/* routes always route through lib/access, lib/http, lib/models
- **Implicit constraint:** CSV data seeding (migrate-to-mongo.mjs) must run before dev server starts; collections must exist or API calls fail
- **Scope integrity:** Bearer token strategy (NEXT_PUBLIC_DASHBOARD_PASSWORD) is simple but sufficient for self-hosted context; no OAuth overhead

---

## Recommended Next Investigations

1. **Motion regression risk:** Audit all 9 plans for CSS property conflict (e.g., inline `width` animate vs Plan 002's `scaleX`)
2. **Fitness backend:** Identify data source for real fitness daily logs and decide whether to use existing Joe integration or custom sync
3. **Guest mode audit:** Grep for `guestWriteGuard` calls in every POST/PUT/DELETE route; ensure none skip it
4. **Animation cleanup:** Verify motion library subscription cleanup in component unmount paths; memory leak risk on route transitions

---

## Graph Statistics

| Metric | Value |
|--------|-------|
| Nodes | 29 |
| Edges | 27 |
| Communities | 4 |
| Avg. degree | 1.9 |
| Max degree (hub) | Mission Control Dashboard (8) |
| Density | 0.065 |
| EXTRACTED edges | 22 (81%) |
| INFERRED edges | 5 (19%) |
| AMBIGUOUS edges | 0 |

---

Generated: 2026-08-07 | Corpus: committed files only (auto scope)
