export interface FitnessContractDailyLog {
  date: string
  morningWeightKg: number
  steps: number
}

export interface FitnessContractSummaryPayload {
  adherence?: {
    weekPct: number | null
    monthPct: number | null
  }
  weightTrend?: {
    trend7dKgPerWeek: number | null
    trend14dKgPerWeek: number | null
    direction: 'down' | 'flat' | 'up'
  }
  protein?: {
    targetG: number
    avg7dG: number | null
    consistencyBand: 'low' | 'medium' | 'high'
  }
  steps?: {
    targetMin: number
    avg7d: number | null
    targetAttainment7dPct: number | null
  }
  training?: {
    plannedSessionsWeek: number
    completedSessionsWeek: number
    completionPctWeek: number | null
    splitByType: {
      push: number
      pull: number
      legs: number
    }
  }
}

export interface FitnessContractChartSeriesPayload {
  weightDaily21d?: Array<{ date: string; value: number | null }>
  weightMovingAvg7d?: Array<{ date: string; value: number | null }>
  proteinDaily21d?: Array<{ date: string; value: number | null }>
  stepsDaily21d?: Array<{ date: string; value: number | null }>
  adherenceDaily21d?: Array<{ date: string; value: number | null }>
}

export interface FitnessContractPayload {
  meta: { generatedAt: string }
  athleteProfile: {
    currentWeightKg: number
    targetWeightKg: number
  }
  kpis: {
    weightTrendKgPerWeek: number | null
    adherencePct: number | null
    avgProteinG: number | null
    avgSteps: number | null
    trainingCompletionPct: number | null
  }
  summaries?: FitnessContractSummaryPayload
  chartSeries?: FitnessContractChartSeriesPayload
  edgeCaseHandling?: string[]
  dailyLogs: FitnessContractDailyLog[]
}

export interface FitnessPanelData {
  departmentId: 'fitness'
  departmentName: 'Fitness'
  lead: 'Arnold'
  lastUpdated: string
  hero: {
    currentWeightKg: number
    targetWeightKg: number
    remainingKg: number
  }
  kpis: {
    weightTrend: number | null
    adherence: number | null
    proteinAvg: number | null
    stepsAvg: number | null
    trainingCompletion: number | null
  }
  summaryCards: {
    adherence: {
      weekPct: number | null
      monthPct: number | null
    }
    weightTrend: {
      trend7dKgPerWeek: number | null
      trend14dKgPerWeek: number | null
      direction: 'down' | 'flat' | 'up'
    }
    protein: {
      avg7dG: number | null
      consistencyBand: 'low' | 'medium' | 'high'
      targetG: number
    }
    steps: {
      avg7d: number | null
      targetAttainment7dPct: number | null
      targetMin: number
    }
    training: {
      completionPctWeek: number | null
      plannedSessionsWeek: number
      completedSessionsWeek: number
      splitByType: {
        push: number
        pull: number
        legs: number
      }
    }
  }
  chart: {
    weightSeries: Array<{ date: string; value: number | null }>
    stepsSeries: Array<{ date: string; value: number | null }>
    weightSeries21d: Array<{ date: string; value: number | null }>
    weightMovingAvg7d: Array<{ date: string; value: number | null }>
    proteinSeries21d: Array<{ date: string; value: number | null }>
    adherenceSeries21d: Array<{ date: string; value: number | null }>
  }
  edgeCaseHandling: string[]
}

/**
 * Converts canonical fitness contract payload to mission-control panel shape.
 */
export function toFitnessPanelData(input: FitnessContractPayload): FitnessPanelData {
  const sortedDailyLogs = [...input.dailyLogs].sort((a, b) => a.date.localeCompare(b.date))
  const trailing7 = sortedDailyLogs.slice(-7)

  const fallbackWeightSeries21d = sortedDailyLogs.slice(-21).map((d) => ({
    date: d.date,
    value: d.morningWeightKg,
  }))
  const chartSeries = input.chartSeries

  return {
    departmentId: 'fitness',
    departmentName: 'Fitness',
    lead: 'Arnold',
    lastUpdated: input.meta.generatedAt,
    hero: {
      currentWeightKg: input.athleteProfile.currentWeightKg,
      targetWeightKg: input.athleteProfile.targetWeightKg,
      remainingKg: Number(
        (input.athleteProfile.currentWeightKg - input.athleteProfile.targetWeightKg).toFixed(1),
      ),
    },
    kpis: {
      weightTrend: input.kpis.weightTrendKgPerWeek,
      adherence: input.kpis.adherencePct,
      proteinAvg: input.kpis.avgProteinG,
      stepsAvg: input.kpis.avgSteps,
      trainingCompletion: input.kpis.trainingCompletionPct,
    },
    summaryCards: {
      adherence: {
        weekPct: input.summaries?.adherence?.weekPct ?? null,
        monthPct: input.summaries?.adherence?.monthPct ?? null,
      },
      weightTrend: {
        trend7dKgPerWeek: input.summaries?.weightTrend?.trend7dKgPerWeek ?? null,
        trend14dKgPerWeek: input.summaries?.weightTrend?.trend14dKgPerWeek ?? null,
        direction: input.summaries?.weightTrend?.direction ?? 'flat',
      },
      protein: {
        avg7dG: input.summaries?.protein?.avg7dG ?? null,
        consistencyBand: input.summaries?.protein?.consistencyBand ?? 'low',
        targetG: input.summaries?.protein?.targetG ?? 0,
      },
      steps: {
        avg7d: input.summaries?.steps?.avg7d ?? null,
        targetAttainment7dPct: input.summaries?.steps?.targetAttainment7dPct ?? null,
        targetMin: input.summaries?.steps?.targetMin ?? 0,
      },
      training: {
        completionPctWeek: input.summaries?.training?.completionPctWeek ?? null,
        plannedSessionsWeek: input.summaries?.training?.plannedSessionsWeek ?? 0,
        completedSessionsWeek: input.summaries?.training?.completedSessionsWeek ?? 0,
        splitByType: input.summaries?.training?.splitByType ?? { push: 0, pull: 0, legs: 0 },
      },
    },
    chart: {
      weightSeries:
        chartSeries?.weightDaily21d?.slice(-7) ??
        trailing7.map((d) => ({ date: d.date, value: d.morningWeightKg })),
      stepsSeries:
        chartSeries?.stepsDaily21d?.slice(-7) ?? trailing7.map((d) => ({ date: d.date, value: d.steps })),
      weightSeries21d: chartSeries?.weightDaily21d ?? fallbackWeightSeries21d,
      weightMovingAvg7d: chartSeries?.weightMovingAvg7d ?? [],
      proteinSeries21d: chartSeries?.proteinDaily21d ?? [],
      adherenceSeries21d: chartSeries?.adherenceDaily21d ?? [],
    },
    edgeCaseHandling: input.edgeCaseHandling ?? [],
  }
}
