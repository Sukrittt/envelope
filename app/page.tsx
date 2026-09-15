import type { Metadata } from 'next'
import { LandingPage } from '../src/views/LandingPage'

export const metadata: Metadata = {
  title: 'Aviary · Envelope budgeting in your currency',
  description: 'Give your money a job before you spend it. Free, open source envelope budgeting in your currency.',
}

export default function Home() {
  return <LandingPage />
}
