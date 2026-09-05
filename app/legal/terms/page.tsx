export const metadata = { title: 'Terms — Envelope' }

const SUPPORT_EMAIL = '[your support email]'

export default function TermsPage() {
  return (
    <article className="legal-doc">
      <h1>Terms of Service</h1>
      <p className="legal-updated">Last updated 4 September 2026</p>

      <p>
        These terms cover your use of Envelope, a personal budgeting app. By creating an account or using the
        app, you agree to them. If you don&apos;t agree, please don&apos;t use Envelope.
      </p>

      <h2>The service</h2>
      <p>
        Envelope helps you track envelopes, expenses, subscriptions, and investments for personal, non-commercial
        use. It&apos;s developed and operated by an individual, not a company, and offered as-is.
      </p>

      <h2>Your account</h2>
      <p>
        You need an account to use Envelope. You&apos;re responsible for keeping the device and email you sign
        in with secure. Tell us at {SUPPORT_EMAIL} if you believe your account has been accessed without your
        permission.
      </p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t use Envelope to:</p>
      <ul>
        <li>resell or offer it as part of another commercial product,</li>
        <li>reverse engineer, scrape, or attempt to disrupt the service,</li>
        <li>upload unlawful content, or</li>
        <li>attempt to access another user&apos;s data.</li>
      </ul>

      <h2>AI features</h2>
      <p>
        Money Brain, bill scanning, and AI-written notifications use a third-party AI model and are best-effort.
        They can be wrong, so double-check anything that matters before you act on it. Nothing Envelope generates
        is financial, tax, legal, or investment advice.
      </p>

      <h2>Third-party services</h2>
      <p>
        Envelope depends on services we don&apos;t control (sign-in, hosting, the AI model, push notifications).
        We aren&apos;t responsible for their outages or changes, though we&apos;ll do our best to keep the app
        working around them.
      </p>

      <h2>Your data</h2>
      <p>
        You own the data you enter. You can export or delete it at any time &mdash; see our{' '}
        <a href="/legal/privacy">Privacy Policy</a> for how, and our{' '}
        <a href="/legal/delete-account">account deletion page</a> for the deletion flow specifically.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account whenever you like. We may suspend or terminate an account that violates
        these terms.
      </p>

      <h2>No warranty</h2>
      <p>
        Envelope is provided &ldquo;as is&rdquo;, without warranty of any kind, including accuracy, availability,
        or fitness for a particular purpose.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, we aren&apos;t liable for indirect, incidental, or consequential damages
        arising from your use of Envelope, including decisions made based on its budgeting figures or AI output.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India, and any dispute will be subject to the jurisdiction of Indian courts.</p>

      <h2>Changes</h2>
      <p>We may update these terms from time to time; the date above reflects the latest revision.</p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <strong>{SUPPORT_EMAIL}</strong>.
      </p>
    </article>
  )
}
