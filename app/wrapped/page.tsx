'use client'

import { Fredoka, Nunito } from 'next/font/google'
import { WrappedExperience } from '@/src/components/wrapped/WrappedExperience'
import '../../src/expense-redesign.css'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

export default function WrappedPage() {
  return <div className={`expense-redesign wrapped-shell ${fredoka.variable} ${nunito.variable}`}><WrappedExperience /></div>
}
