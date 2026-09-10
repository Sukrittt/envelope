'use client'

import { Fredoka, Nunito } from 'next/font/google'
import '@/src/expense-redesign.css'
import '@/src/insights.css'
import { InsightsPage } from '@/src/views/InsightsPage'

const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

export default function Page() {
  return <div className={`${fredoka.variable} ${nunito.variable}`}><InsightsPage /></div>
}
