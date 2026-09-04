import { json, error, readBody } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { isRateLimited } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const BURST_WINDOW_MS = 5 * 60 * 1000
const BURST_LIMIT = 2
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000
const DAY_LIMIT = 8

// Same repo the old Linking.openURL links pointed at (Mobile/app/account/help.tsx).
const GITHUB_REPO = 'Sukrittt/ynab-replacement'

const TITLE_MAX = 150
const DESCRIPTION_MAX = 4000

/** Coerces an unknown diagnostics field to a short trusted string — the client supplies these, so shape is never assumed. */
function diag(value: unknown): string {
  return String(value ?? 'unknown').slice(0, 200)
}

/**
 * Files a GitHub issue on behalf of the signed-in user, replacing the old
 * Linking.openURL(github.com/.../issues/new) flow so reporting never leaves
 * the app. GitHub is the only store — no Mongo collection — so a failed
 * GitHub call loses the report and the user just retries.
 *
 * No user id or email goes into the issue body: the repo is public.
 */
export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  if (
    await isRateLimited(`feedback:${auth.userId}`, [
      { windowMs: BURST_WINDOW_MS, limit: BURST_LIMIT },
      { windowMs: DAY_WINDOW_MS, limit: DAY_LIMIT },
    ])
  ) {
    return error('rate limited', 429)
  }

  const body = await readBody(req)
  const type = body.type === 'bug' || body.type === 'idea' ? body.type : null
  if (!type) return error('type required')

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, TITLE_MAX) : ''
  if (!title) return error('title required')

  const description = typeof body.description === 'string' ? body.description.trim().slice(0, DESCRIPTION_MAX) : ''
  if (!description) return error('description required')

  const diagnostics = (body.diagnostics && typeof body.diagnostics === 'object' ? body.diagnostics : {}) as Record<string, unknown>

  const token = process.env.GITHUB_ISSUES_TOKEN
  if (!token) {
    console.error('GITHUB_ISSUES_TOKEN is not set — cannot file feedback issue')
    return error('could not send that', 502)
  }

  const issueTitle = `${type === 'bug' ? 'Bug' : 'Idea'}: ${title}`
  const labels = type === 'bug' ? ['bug'] : ['enhancement']
  const markdown = [
    description,
    '',
    '---',
    '**Diagnostics** (auto-attached)',
    `- App: ${diag(diagnostics.appVersion)}`,
    `- Device: ${diag(diagnostics.device)}`,
    `- Screen: ${diag(diagnostics.screen)}`,
  ].join('\n')

  let resp: Response
  try {
    resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'envelope-feedback',
      },
      body: JSON.stringify({ title: issueTitle, body: markdown, labels }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error('GitHub issue create failed (network):', err)
    return error('could not send that', 502)
  }

  if (!resp.ok) {
    console.error('GitHub issue create failed:', resp.status, await resp.text().catch(() => ''))
    return error('could not send that', 502)
  }

  const issue = await resp.json()
  return json({ url: issue.html_url as string })
}
