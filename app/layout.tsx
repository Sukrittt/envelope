import type { Metadata } from 'next'
import '../src/index.css'
import '../src/App.css'
import { ClientProviders } from '../components/ClientProviders'

export const metadata: Metadata = {
  title: 'YNAB Replacement',
  description: 'YNAB Replacement — budget, expense, investments, and mission dashboard',
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