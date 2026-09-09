import type { Metadata } from 'next'
// tokens.css first: every other sheet reads its --tk-* custom properties.
import '../src/theme/tokens.css'
import '../src/index.css'
import '../src/App.css'
import { ClientProviders } from '../components/ClientProviders'

export const metadata: Metadata = {
  title: 'Aviary',
  description: 'Aviary — envelope budgeting, expenses, subscriptions and investments in one place',
  icons: { icon: '/favicon.svg' },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}