import { getSystemSettings } from '@/lib/systemSettings'
import { ActionForm, SubmitButton } from '../ActionForm'
import { saveSettingsAction } from './actions'

export default async function AdminSystem() {
  const settings = await getSystemSettings()

  return (
    <>
      <div className="adm-head">
        <h1>System</h1>
        <span className="adm-sub">Global switches · every change is audited</span>
      </div>

      <section className="erd-card">
        <ActionForm action={saveSettingsAction} className="adm-form" key={JSON.stringify(settings)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input type="checkbox" name="aiDisabled" defaultChecked={settings.aiDisabled} style={{ marginTop: 4 }} />
              <span>
                <strong>Disable AI features</strong>
                <div className="adm-sub">Money Brain chat, daily brief, bill scan and category suggestions answer 503. Coach pushes fall back to their plain text.</div>
              </span>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input type="checkbox" name="maintenanceOn" defaultChecked={settings.maintenance.on} style={{ marginTop: 4 }} />
              <span>
                <strong>Show maintenance banner</strong>
                <div className="adm-sub">Shown at the top of every web page and returned by GET /api/system/status.</div>
              </span>
            </label>

            <input className="adm-input" name="maintenanceMessage" defaultValue={settings.maintenance.message} placeholder="e.g. Scheduled maintenance tonight 11pm–midnight IST" maxLength={280} />

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <strong>Android app update</strong>
              <div className="adm-sub">Set this after a new Play Store release. Leave the version empty to hide the update link in the app.</div>
            </div>

            <input
              className="adm-input"
              name="androidLatestVersion"
              defaultValue={settings.appUpdate.android.latestVersion}
              placeholder="Latest version, e.g. 2.3.0"
              inputMode="decimal"
              maxLength={32}
            />

            <input
              className="adm-input"
              name="androidStoreUrl"
              defaultValue={settings.appUpdate.android.storeUrl}
              placeholder="Google Play Store URL"
              type="url"
              maxLength={500}
            />

            <div>
              <SubmitButton variant="primary">Save</SubmitButton>
            </div>
          </div>
        </ActionForm>
      </section>
    </>
  )
}
