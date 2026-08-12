'use client'

import { Fredoka, Nunito } from 'next/font/google'
import '../../src/expense-redesign.css'
import { ExpensePage } from '../../src/views/ExpensePage'

const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

export default function ExpenseRoute() {
  return (
    <div className={`${fredoka.variable} ${nunito.variable}`}>
      <ExpensePage />
    </div>
  )
}
