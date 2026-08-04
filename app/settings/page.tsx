'use client'

import { SettingsPage } from '../../src/views/SettingsPage'
import { useAppearance } from '../../components/AppearanceProvider'
import { clearAccess } from '../../src/services/accessMode'

export default function SettingsRoute() {
  const { theme, setTheme, density, setDensity } = useAppearance()
  return (
    <SettingsPage
      theme={theme}
      onThemeChange={setTheme}
      density={density}
      onDensityChange={setDensity}
      onLogout={clearAccess}
    />
  )
}