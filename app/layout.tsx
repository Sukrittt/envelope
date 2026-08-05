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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400;1,9..40,500&family=DM+Serif+Display:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}