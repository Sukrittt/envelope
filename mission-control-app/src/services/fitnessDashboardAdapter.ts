export type SplitType = 'push' | 'pull' | 'legs' | 'rest'

export interface TrainingTopSet {
  exercise: string
  weightKg: number
  reps: number
}

export interface FitnessDailyLog {
  date: string
  morningWeightKg: number
  caloriesKcal: number
  proteinG: number
  steps: number
  workout: {
    status: 'done' | 'rest' | 'missed' | string
    type: SplitType | string
    completed?: boolean
    topSet?: TrainingTopSet
    pr?: {
      exercise: string
      value: string
    } | null
  }
  adherence: { calorieInRange: boolean; proteinMet: boolean; stepsMet: boolean }
}

export interface FitnessDashboardContract {
  meta: { generatedAt: string; weekStart: string }
  athleteProfile: {
    currentWeightKg: number
    targetWeightKg: number
  }
  targets: {
    calorieRange: { min: number; max: number }
    proteinG: number
    stepsMin: number
    plannedTrainingSessions: number
  }
  dailyLogs: FitnessDailyLog[]
  kpis: {
    weightTrendKgPerWeek: number
    adherencePct: number
    avgProteinG: number
    avgSteps: number
    trainingCompletionPct: number
  }
}

export interface FitnessDashboardPanel {
  lastUpdated: string
  currentWeightKg: number
  targetWeightKg: number
  remainingKg: number
  adherencePct: number
  trainingCompletionPct: number
  avgProteinG: number
  proteinTargetG: number
  avgSteps: number
  stepTarget: number
  caloriesAvg: number
  caloriesBand: { min: number; max: number }
  workoutStreakDays: number
  weightSeries: Array<{ date: string; value: number }>
  stepsSeries: Array<{ date: string; value: number }>
  nutritionCompliance: {
    hitDays7d: number
    missDays7d: number
    proteinConsistencyBand: 'high' | 'medium' | 'low'
  }
  trainingDetail: {
    splitCounts7d: Record<SplitType, number>
    latestTopSet: TrainingTopSet | null
    latestPr: { date: string; exercise: string; value: string } | null
  }
  summaryCards: {
    adherenceWeekPct: number
    adherenceMonthPct: number
    trend7dKgPerWeek: number
    trend14dKgPerWeek: number
  }
  dailyInsight: {
    date: string
    action: string
    reason: string
  }
}

function average(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function calculateWeightTrend(logs: FitnessDailyLog[]): number {
  if (logs.length < 2) return 0
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0].morningWeightKg
  const last = sorted[sorted.length - 1].morningWeightKg
  return Number((((last - first) / Math.max(logs.length - 1, 1)) * 7).toFixed(2))
}

function getProteinBand(recent7: FitnessDailyLog[], target: number): 'high' | 'medium' | 'low' {
  if (!recent7.length) return 'low'
  const hitRate = recent7.filter((row) => row.proteinG >= target).length / recent7.length
  if (hitRate >= 0.8) return 'high'
  if (hitRate >= 0.5) return 'medium'
  return 'low'
}

function pickInsight(recent7: FitnessDailyLog[], input: FitnessDashboardContract): { action: string; reason: string } {
  const missedCalories = recent7.filter((row) => !row.adherence.calorieInRange).length
  const proteinMisses = recent7.filter((row) => !row.adherence.proteinMet).length
  const lowStepsDays = recent7.filter((row) => row.steps < input.targets.stepsMin).length
  const missedTraining = recent7.filter((row) => row.workout.status === 'missed').length

  if (proteinMisses >= 2) {
    return {
      action: 'Add one 25g protein serving to dinner today.',
      reason: `${proteinMisses}/7 days missed protein target.`,
    }
  }

  if (missedCalories >= 2) {
    return {
      action: `Keep intake inside ${input.targets.calorieRange.min}-${input.targets.calorieRange.max} kcal today.`,
      reason: `${missedCalories}/7 days were outside calorie range.`,
    }
  }

  if (lowStepsDays >= 2) {
    return {
      action: 'Add a 20-minute walk after your last meal.',
      reason: `${lowStepsDays}/7 days were below step floor.`,
    }
  }

  if (missedTraining >= 1) {
    return {
      action: 'Run your scheduled split session before dinner.',
      reason: `${missedTraining} planned workout was missed this week.`,
    }
  }

  return {
    action: 'Repeat yesterday\'s plan exactly to preserve momentum.',
    reason: 'Execution is stable across nutrition, training, and activity.',
  }
}

export function toFitnessDashboardPanel(input: FitnessDashboardContract): FitnessDashboardPanel {
  const trailing = [...input.dailyLogs].sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  const recent14 = trailing.slice(-14)
  const recent7 = trailing.slice(-7)

  let streak = 0
  for (let index = recent7.length - 1; index >= 0; index -= 1) {
    if (recent7[index]?.workout.completed) {
      streak += 1
      continue
    }
    break
  }

  const hitDays7d = recent7.filter((row) => row.adherence.calorieInRange).length
  const splitCounts7d: Record<SplitType, number> = { push: 0, pull: 0, legs: 0, rest: 0 }
  for (const row of recent7) {
    const split = row.workout.type as SplitType
    if (split in splitCounts7d) splitCounts7d[split] += 1
  }

  const latestTopSet = [...recent7].reverse().find((row) => row.workout.topSet)?.workout.topSet ?? null
  const latestPrRow = [...recent14].reverse().find((row) => row.workout.pr)
  const insight = pickInsight(recent7, input)

  return {
    lastUpdated: input.meta.generatedAt,
    currentWeightKg: input.athleteProfile.currentWeightKg,
    targetWeightKg: input.athleteProfile.targetWeightKg,
    remainingKg: Number((input.athleteProfile.currentWeightKg - input.athleteProfile.targetWeightKg).toFixed(1)),
    adherencePct: input.kpis.adherencePct,
    trainingCompletionPct: input.kpis.trainingCompletionPct,
    avgProteinG: Number(input.kpis.avgProteinG.toFixed(1)),
    proteinTargetG: input.targets.proteinG,
    avgSteps: Math.round(input.kpis.avgSteps),
    stepTarget: input.targets.stepsMin,
    caloriesAvg: Math.round(average(recent7.map((row) => row.caloriesKcal))),
    caloriesBand: {
      min: input.targets.calorieRange.min,
      max: input.targets.calorieRange.max,
    },
    workoutStreakDays: streak,
    weightSeries: recent7.map((row) => ({ date: row.date, value: row.morningWeightKg })),
    stepsSeries: recent7.map((row) => ({ date: row.date, value: row.steps })),
    nutritionCompliance: {
      hitDays7d,
      missDays7d: recent7.length - hitDays7d,
      proteinConsistencyBand: getProteinBand(recent7, input.targets.proteinG),
    },
    trainingDetail: {
      splitCounts7d,
      latestTopSet,
      latestPr: latestPrRow?.workout.pr
        ? {
            date: latestPrRow.date,
            exercise: latestPrRow.workout.pr.exercise,
            value: latestPrRow.workout.pr.value,
          }
        : null,
    },
    summaryCards: {
      adherenceWeekPct: Number(input.kpis.adherencePct.toFixed(1)),
      adherenceMonthPct: Number((average(trailing.map((row) => {
        const checks = [row.adherence.calorieInRange, row.adherence.proteinMet, row.adherence.stepsMet]
        return (checks.filter(Boolean).length / checks.length) * 100
      })) || 0).toFixed(1)),
      trend7dKgPerWeek: calculateWeightTrend(recent7),
      trend14dKgPerWeek: calculateWeightTrend(recent14),
    },
    dailyInsight: {
      date: recent7[recent7.length - 1]?.date ?? input.meta.weekStart,
      action: insight.action,
      reason: insight.reason,
    },
  }
}
