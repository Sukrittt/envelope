# Joe Integration Note (Fitness -> Mission Control)

## Exact field mapping (contract -> panel)

### Hero
- `athleteProfile.currentWeightKg` -> `hero.currentWeightKg`
- `athleteProfile.targetWeightKg` -> `hero.targetWeightKg`
- `hero.remainingKg` = `currentWeightKg - targetWeightKg` (1 decimal)

### Top KPI strip
- `kpis.weightTrendKgPerWeek` -> `kpis.weightTrend`
- `kpis.adherencePct` -> `kpis.adherence`
- `kpis.avgProteinG` -> `kpis.proteinAvg`
- `kpis.avgSteps` -> `kpis.stepsAvg`
- `kpis.trainingCompletionPct` -> `kpis.trainingCompletion`

### Summary cards (new)
- `summaries.adherence.weekPct` -> `summaryCards.adherence.weekPct`
- `summaries.adherence.monthPct` -> `summaryCards.adherence.monthPct`

- `summaries.weightTrend.trend7dKgPerWeek` -> `summaryCards.weightTrend.trend7dKgPerWeek`
- `summaries.weightTrend.trend14dKgPerWeek` -> `summaryCards.weightTrend.trend14dKgPerWeek`
- `summaries.weightTrend.direction` -> `summaryCards.weightTrend.direction`

- `summaries.protein.avg7dG` -> `summaryCards.protein.avg7dG`
- `summaries.protein.consistencyBand` -> `summaryCards.protein.consistencyBand`
- `summaries.protein.targetG` -> `summaryCards.protein.targetG`

- `summaries.steps.avg7d` -> `summaryCards.steps.avg7d`
- `summaries.steps.targetAttainment7dPct` -> `summaryCards.steps.targetAttainment7dPct`
- `summaries.steps.targetMin` -> `summaryCards.steps.targetMin`

- `summaries.training.completionPctWeek` -> `summaryCards.training.completionPctWeek`
- `summaries.training.plannedSessionsWeek` -> `summaryCards.training.plannedSessionsWeek`
- `summaries.training.completedSessionsWeek` -> `summaryCards.training.completedSessionsWeek`
- `summaries.training.splitByType` -> `summaryCards.training.splitByType`

### Charts
- `chartSeries.weightDaily21d.slice(-7)` -> `chart.weightSeries` (legacy mini chart)
- `chartSeries.stepsDaily21d.slice(-7)` -> `chart.stepsSeries` (legacy mini chart)
- `chartSeries.weightDaily21d` -> `chart.weightSeries21d`
- `chartSeries.weightMovingAvg7d` -> `chart.weightMovingAvg7d`
- `chartSeries.proteinDaily21d` -> `chart.proteinSeries21d`
- `chartSeries.adherenceDaily21d` -> `chart.adherenceSeries21d`

### Edge-case notes
- `edgeCaseHandling[]` -> `edgeCaseHandling[]` (render in tooltip/help drawer)

---

## Card / chart integration priority (ship order)
1. **Adherence card (week/month)** + KPI strip adherence
2. **Weight trend card (7d + 14d)** + 21d weight line with moving average overlay
3. **Protein card (avg + consistency band)** + protein daily bars
4. **Steps card (avg + attainment)** + steps daily bars
5. **Training card (completion + Push/Pull/Legs split)** + split donut/stacked bar

---

## Edge cases to enforce in UI
1. **Insufficient trend data**: if `<4` valid weight points in window, trend = `null`, card state `insufficient_data`.
2. **Missing day entries**: keep sparse series; do not inject zero placeholders.
3. **Rest day semantics**: `workout.status = rest` is neutral, not missed session.
4. **Missing protein/steps**: exclude from that metric denominator; preserve null in raw.
5. **Large single-day weight jump** (`±1.0kg`): annotate as outlier, do not clamp.

## Notes
- Adapter now supports fallbacks: if `chartSeries` absent, derives 7-day series from `dailyLogs`.
- Keep panel consumers bound to normalized `summaryCards` + `chart` keys only.
