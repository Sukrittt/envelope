import { useState } from 'react'
import { SparkBars } from './SparkBars'

export function FluidDemo() {
  const [data] = useState([
    { date: '2026-08-01', value: 100 },
    { date: '2026-08-02', value: 150 },
    { date: '2026-08-03', value: 200 },
    { date: '2026-08-04', value: 120 },
    { date: '2026-08-05', value: 180 },
    { date: '2026-08-06', value: 250 },
    { date: '2026-08-07', value: 300 },
  ])

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Apple-like Fluid Interactions Demo</h2>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        Try clicking and dragging on the bars to experience the fluid spring animations
      </p>

      <div style={{ marginBottom: '40px' }}>
        <h3>With Fluid Interactions (Apple-like)</h3>
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
          <SparkBars
            data={data}
            size="default"
            enableFluidInteractions
          />
        </div>
      </div>

      <div style={{ marginBottom: '40px' }}>
        <h3>Without Fluid Interactions (Standard)</h3>
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
          <SparkBars
            data={data}
            size="default"
            enableFluidInteractions={false}
          />
        </div>
      </div>

      <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
        <h4>Apple Design Principles Implemented:</h4>
        <ul style={{ paddingLeft: '20px' }}>
          <li>✓ Immediate feedback on pointer down (instant scale transform)</li>
          <li>✓ Direct manipulation - bars track 1:1 with pointer movement</li>
          <li>✓ Interruptible spring animations - can be grabbed mid-flight</li>
          <li>✓ Velocity handoff - animations continue at finger&apos;s velocity</li>
          <li>✓ Reduced motion support - respects user preferences</li>
          <li>✓ Rubber-banding effect on hover</li>
          <li>✓ Smooth tooltip transitions with proper easing</li>
        </ul>
      </div>
    </div>
  )
}
