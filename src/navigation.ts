export interface NavItem {
  label: string
  path: string
  exact?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Master Dashboard',
    items: [
      { label: 'Expense', path: '/expense' },
      { label: 'Fitness', path: '/fitness' },
      { label: 'Learnings', path: '/learnings' },
    ],
  },
  {
    label: 'Admin',
    items: [{ label: 'Settings', path: '/settings' }],
  },
]
