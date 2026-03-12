# Fitness KPI Definitions (Dashboard Contract v1.0)

Window defaults to trailing 7 days unless stated otherwise.

## 1) Weight Trend (`weightTrendKgPerWeek`)
- **Definition:** weeklyized change from daily morning scale values.
- **Formula:** `((latest_weight - earliest_weight) / days_between) * 7`
- **Unit:** kg/week (negative is fat-loss direction).
- **Guardrails:**
  - If fewer than 4 valid weight points, return `null` and set UI state `insufficient_data`.
  - Flag extreme trend if `< -1.2 kg/week` or `> +0.4 kg/week`.

## 2) Adherence (`adherencePct`)
- **Definition:** aggregate process adherence over calorie range, protein target, and steps target.
- **Formula:**
  - Per day checks: `calorieInRange`, `proteinMet`, `stepsMet` (booleans)
  - `adherencePct = (sum(true checks across days) / (days * 3)) * 100`
- **Unit:** percentage.

## 3) Average Protein (`avgProteinG`)
- **Definition:** mean daily protein intake over window.
- **Formula:** `sum(protein_g) / valid_days`
- **Unit:** grams/day.

## 4) Average Steps (`avgSteps`)
- **Definition:** mean daily step count over window.
- **Formula:** `sum(steps) / valid_days`
- **Unit:** steps/day.

## 5) Training Completion (`trainingCompletionPct`)
- **Definition:** completed sessions vs planned sessions in the week.
- **Formula:** `(completed_training_sessions / planned_training_sessions) * 100`
- **Unit:** percentage.
- **Rule:** days with `workout.status=rest` are not auto-fail; they are neutral unless session was planned.

## Suggested UI thresholds
- **Green:** adherence >= 85, protein avg >= target-5, steps avg >= target-500
- **Amber:** adherence 70-84
- **Red:** adherence < 70 or weight trend outside guardrail
