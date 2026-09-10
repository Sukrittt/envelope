import type { Metadata } from 'next'
import { Fredoka, Nunito } from 'next/font/google'
import { LandingPage } from '../src/views/LandingPage'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], variable: '--font-nunito', display: 'swap' })

export const metadata: Metadata = {
  title: 'Aviary · Envelope budgeting for rupees',
  description: 'Give every rupee a job before you spend it. Free, open source envelope budgeting built for India.',
}

export default function Home() {
  return (
    <div className={`${fredoka.variable} ${nunito.variable}`}>
      <LandingPage />
    </div>
  )
}
