import mockData from '../data/mockData.json'
import type {
  ActivityItem,
  DashboardData,
  DailyUpdate,
  DepartmentCard,
  DepartmentSyncStatus,
  ExternalModuleSummary,
  Kpi,
  LearningItem,
  RiskItem,
  RiskSeverity,
  Status,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL

const DEFAULT_DASHBOARD: DashboardData = {
  dateLabel: 'Unavailable',
  overallHealth: 'amber',
  kpis: [],
  departments: [],
  dailyUpdates: [],
  learnings: [],
  risks: [],
  activities: [],
  externalModules: [],
  crossDepartmentSync: [],
}

function toStatus(value: unknown): Status {
  return value === 'green' || value === 'amber' || value === 'red' ? value : 'amber'
}

function toRiskSeverity(value: unknown): RiskSeverity {
  return value === 'critical' || value === 'high' || value === 'med' || value === 'low' ? value : 'med'
}

function ensureStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function toKpi(value: unknown): Kpi | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.label !== 'string' || typeof row.value !== 'string') return null

  return {
    label: row.label,
    value: row.value,
    tone: toStatus(row.tone),
  }
}

function toDepartment(value: unknown): DepartmentCard | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>

  if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.lead !== 'string') return null

  return {
    id: row.id,
    name: row.name,
    lead: row.lead,
    status: toStatus(row.status),
    lastUpdate: typeof row.lastUpdate === 'string' ? row.lastUpdate : 'Unknown',
    activeInitiatives: typeof row.activeInitiatives === 'number' ? row.activeInitiatives : 0,
    openRisks: typeof row.openRisks === 'number' ? row.openRisks : 0,
  }
}

function toDailyUpdate(value: unknown): DailyUpdate | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>

  if (typeof row.departmentId !== 'string' || typeof row.departmentName !== 'string') return null

  return {
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    status: toStatus(row.status),
    done: ensureStringArray(row.done),
    changed: ensureStringArray(row.changed),
    next: ensureStringArray(row.next),
    risk: ensureStringArray(row.risk),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : 'Unknown',
  }
}

function toLearning(value: unknown): LearningItem | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>

  if (
    typeof row.id !== 'string' ||
    typeof row.departmentName !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.note !== 'string'
  ) {
    return null
  }

  return {
    id: row.id,
    departmentName: row.departmentName,
    title: row.title,
    note: row.note,
    tags: ensureStringArray(row.tags),
    author: typeof row.author === 'string' ? row.author : 'Unknown',
    time: typeof row.time === 'string' ? row.time : 'Unknown',
    importance: row.importance === 'high' ? 'high' : 'normal',
  }
}

function toRisk(value: unknown): RiskItem | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>

  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.owner !== 'string' ||
    typeof row.departmentName !== 'string'
  ) {
    return null
  }

  return {
    id: row.id,
    title: row.title,
    severity: toRiskSeverity(row.severity),
    owner: row.owner,
    departmentName: row.departmentName,
    mitigation: typeof row.mitigation === 'string' ? row.mitigation : 'No mitigation provided',
    dueDate: typeof row.dueDate === 'string' ? row.dueDate : 'N/A',
    state:
      row.state === 'open' || row.state === 'monitoring' || row.state === 'mitigated' || row.state === 'closed'
        ? row.state
        : 'open',
  }
}

function toActivity(value: unknown): ActivityItem | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>

  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.detail !== 'string' ||
    typeof row.departmentName !== 'string'
  ) {
    return null
  }

  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    departmentName: row.departmentName,
    timestamp: typeof row.timestamp === 'string' ? row.timestamp : 'Unknown',
    type: row.type === 'update' || row.type === 'risk' || row.type === 'learning' ? row.type : 'update',
  }
}

function toExternalModule(value: unknown): ExternalModuleSummary | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>

  if (
    (row.module !== 'expense' && row.module !== 'fitness') ||
    typeof row.title !== 'string' ||
    typeof row.primaryMetric !== 'string' ||
    typeof row.secondaryMetric !== 'string'
  ) {
    return null
  }

  return {
    module: row.module,
    title: row.title,
    health: toStatus(row.health),
    lastSync: typeof row.lastSync === 'string' ? row.lastSync : 'Unknown',
    primaryMetric: row.primaryMetric,
    secondaryMetric: row.secondaryMetric,
    deepLinks: Array.isArray(row.deepLinks)
      ? row.deepLinks
          .filter((link): link is Record<string, unknown> => !!link && typeof link === 'object')
          .map((link) => ({
            label: typeof link.label === 'string' ? link.label : 'Link',
            url: typeof link.url === 'string' ? link.url : '#',
          }))
      : [],
    notes: typeof row.notes === 'string' ? row.notes : '',
  }
}

function toDepartmentSync(value: unknown): DepartmentSyncStatus | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>

  if (
    (row.department !== 'Engineering' &&
      row.department !== 'UI/UX' &&
      row.department !== 'Fitness' &&
      row.department !== 'Ops') ||
    typeof row.owner !== 'string'
  ) {
    return null
  }

  return {
    department: row.department,
    owner: row.owner,
    status: toStatus(row.status),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : 'Unknown',
    block: typeof row.block === 'string' ? row.block : 'None',
    next: typeof row.next === 'string' ? row.next : 'TBD',
  }
}

function normalizeDashboardData(value: unknown): DashboardData {
  if (!value || typeof value !== 'object') return DEFAULT_DASHBOARD
  const row = value as Record<string, unknown>

  return {
    dateLabel: typeof row.dateLabel === 'string' ? row.dateLabel : DEFAULT_DASHBOARD.dateLabel,
    overallHealth: toStatus(row.overallHealth),
    kpis: Array.isArray(row.kpis) ? row.kpis.map(toKpi).filter((entry): entry is Kpi => !!entry) : [],
    departments: Array.isArray(row.departments)
      ? row.departments.map(toDepartment).filter((entry): entry is DepartmentCard => !!entry)
      : [],
    dailyUpdates: Array.isArray(row.dailyUpdates)
      ? row.dailyUpdates.map(toDailyUpdate).filter((entry): entry is DailyUpdate => !!entry)
      : [],
    learnings: Array.isArray(row.learnings)
      ? row.learnings.map(toLearning).filter((entry): entry is LearningItem => !!entry)
      : [],
    risks: Array.isArray(row.risks) ? row.risks.map(toRisk).filter((entry): entry is RiskItem => !!entry) : [],
    activities: Array.isArray(row.activities)
      ? row.activities.map(toActivity).filter((entry): entry is ActivityItem => !!entry)
      : [],
    externalModules: Array.isArray(row.externalModules)
      ? row.externalModules.map(toExternalModule).filter((entry): entry is ExternalModuleSummary => !!entry)
      : [],
    crossDepartmentSync: Array.isArray(row.crossDepartmentSync)
      ? row.crossDepartmentSync.map(toDepartmentSync).filter((entry): entry is DepartmentSyncStatus => !!entry)
      : [],
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  if (!API_BASE) {
    return normalizeDashboardData(mockData)
  }

  const response = await fetch(`${API_BASE}/mission-control/dashboard`)

  if (!response.ok) {
    throw new Error('Failed to fetch mission control dashboard data')
  }

  const payload: unknown = await response.json()
  return normalizeDashboardData(payload)
}
