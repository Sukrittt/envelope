const REPO_URL = 'https://github.com/Sukrittt/ynab-replacement'

const BUG_URL = `${REPO_URL}/issues/new?${new URLSearchParams({
  title: 'Bug: ',
  body: '**What happened**\n\n**What you expected**\n\n**Steps to reproduce**\n\n**Screenshots (optional)**\n',
  labels: 'bug',
}).toString()}`

const FEATURE_URL = `${REPO_URL}/issues/new?${new URLSearchParams({
  title: 'Feature: ',
  body: '**What problem does this solve?**\n\n**What would you like to happen?**\n',
  labels: 'enhancement',
}).toString()}`

export default function HelpPage() {
  return (
    <>
      <div className="account-card">
        <div style={{ padding: 16 }}>
          <div className="account-row-label" style={{ marginBottom: 6 }}>
            How envelopes work
          </div>
          <p className="account-help-copy">
            Every rupee of income gets assigned to an envelope — rent, food, subscriptions, whatever you spend on.
            Money that hasn&apos;t been assigned yet sits in Ready to Assign. Overspend an envelope and you move
            money into it from another one; the total never lies, it just moves. At the start of a new month,
            whatever&apos;s left in each envelope rolls forward instead of resetting to zero, so a slow month in
            one category quietly covers a busy one later.
          </p>
        </div>
      </div>
      <div className="account-card">
        <a href={BUG_URL} target="_blank" rel="noreferrer" className="account-row">
          <span className="account-row-icon" aria-hidden="true">
            🐛
          </span>
          <span className="account-row-label">Report a bug</span>
          <span className="account-row-arrow" aria-hidden="true">
            →
          </span>
        </a>
        <a href={FEATURE_URL} target="_blank" rel="noreferrer" className="account-row">
          <span className="account-row-icon" aria-hidden="true">
            💬
          </span>
          <span className="account-row-label">Send feedback</span>
          <span className="account-row-arrow" aria-hidden="true">
            →
          </span>
        </a>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="account-row">
          <span className="account-row-icon" aria-hidden="true">
            ⭐
          </span>
          <span className="account-row-label">Star the repo</span>
          <span className="account-row-arrow" aria-hidden="true">
            →
          </span>
        </a>
      </div>
    </>
  )
}
