export function PageSectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mc-panel-header">
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  )
}
