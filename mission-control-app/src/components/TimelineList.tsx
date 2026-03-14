import type { ActivityItem } from '../types'

export function TimelineList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="mc-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <div className={`timeline-dot ${item.type}`} />
          <div>
            <p className="timeline-title">{item.title}</p>
            <p className="timeline-meta">
              {item.departmentName} • {item.timestamp}
            </p>
            <p>{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
