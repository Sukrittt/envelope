interface SettingsPageProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  density: 'comfortable' | 'compact'
  onDensityChange: (density: 'comfortable' | 'compact') => void
}

export function SettingsPage({ theme, onThemeChange, density, onDensityChange }: SettingsPageProps) {
  return (
    <section className="mc-content-grid">
      <article className="mc-panel">
        <div className="mc-panel-header">
          <h1>Settings</h1>
          <p>Operational preferences and display controls</p>
        </div>

        <div className="mc-settings-grid">
          <section className="mc-setting-card">
            <div className="setting-header">
              <h3>Appearance</h3>
              <p className="muted">Theme mode</p>
            </div>
            <div className="setting-controls">
              <div className="segmented-control" role="group" aria-label="Theme mode">
                <button className={`action-button ${theme === 'light' ? 'is-active' : ''}`} onClick={() => onThemeChange('light')}>
                  Light
                </button>
                <button className={`action-button ${theme === 'dark' ? 'is-active' : ''}`} onClick={() => onThemeChange('dark')}>
                  Dark
                </button>
              </div>
            </div>
          </section>

          <section className="mc-setting-card">
            <div className="setting-header">
              <h3>Density</h3>
              <p className="muted">UI compactness for operations view</p>
            </div>
            <div className="setting-controls">
              <div className="segmented-control" role="group" aria-label="Density mode">
                <button
                  className={`action-button ${density === 'comfortable' ? 'is-active' : ''}`}
                  onClick={() => onDensityChange('comfortable')}
                >
                  Comfortable
                </button>
                <button className={`action-button ${density === 'compact' ? 'is-active' : ''}`} onClick={() => onDensityChange('compact')}>
                  Compact
                </button>
              </div>
            </div>
          </section>

          <section className="mc-setting-card">
            <div className="setting-header">
              <h3>Notifications</h3>
              <p className="muted">Risk alert threshold</p>
            </div>
            <div className="setting-controls">
              <select defaultValue="high">
                <option value="critical">Critical only</option>
                <option value="high">High and above</option>
                <option value="med">Medium and above</option>
              </select>
            </div>
          </section>

          <section className="mc-setting-card">
            <div className="setting-header">
              <h3>Data refresh</h3>
              <p className="muted">Cadence: every 15 minutes</p>
            </div>
            <div className="setting-controls">
              <button className="action-button">Manual refresh trigger</button>
            </div>
          </section>
        </div>
      </article>
    </section>
  )
}
