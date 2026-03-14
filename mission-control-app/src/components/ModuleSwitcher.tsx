import { NavLink } from 'react-router-dom'

const moduleTabs = [
  { label: 'Mission', path: '/' },
  { label: 'Expense', path: '/expense' },
  { label: 'Fitness', path: '/fitness' },
]

export function ModuleSwitcher() {
  return (
    <div className="module-switcher" aria-label="Master dashboard module switcher">
      {moduleTabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          end={tab.path === '/'}
          className={({ isActive }) => (isActive ? 'module-pill active' : 'module-pill')}
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  )
}
