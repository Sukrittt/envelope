# Joe Integration Note (Fitness -> Mission Control)

## Field mapping (contract -> panel)
- `athleteProfile.currentWeightKg` -> `hero.currentWeightKg`
- `athleteProfile.targetWeightKg` -> `hero.targetWeightKg`
- `kpis.weightTrendKgPerWeek` -> `kpis.weightTrend`
- `kpis.adherencePct` -> `kpis.adherence`
- `kpis.avgProteinG` -> `kpis.proteinAvg`
- `kpis.avgSteps` -> `kpis.stepsAvg`
- `kpis.trainingCompletionPct` -> `kpis.trainingCompletion`
- `dailyLogs[]` (last 7 sorted by `date`) -> `chart.weightSeries`, `chart.stepsSeries`

## Edge cases
1. **Insufficient history**
   - If `<4` weight points, render trend as `N/A` and show tooltip `Need more days`.
2. **Missing day entries**
   - Do not backfill with zeros. Keep sparse series and let chart handle gaps.
3. **Rest day semantics**
   - `workout.status = rest` is not failed adherence by default.
4. **Outlier jumps**
   - Highlight but do not clamp if single-day weight delta exceeds `±1.0 kg`; likely water/glycogen noise.
5. **Timezone drift**
   - Use `meta.timezone` when determining "today" and current week boundaries.

## Integration contract guarantee
- Dashboard adapter normalizes to stable panel keys so frontend components do not depend on raw contract nesting.
