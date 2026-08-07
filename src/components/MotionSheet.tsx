import { useReducedMotion, motion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'

type MotionSheetProps = {
  children?: ReactNode
  className?: string
} & Omit<HTMLMotionProps<'div'>, 'children' | 'className'>

/**
 * Critically damped (bounce: 0) spring transition — Apple's default UI spring
 * (damping 1.0, response ~0.35s). No overshoot.
 */
const SPRING = { type: 'spring', bounce: 0, duration: 0.35 } as const
const FADE = { type: 'tween', duration: 0.2 } as const

export function Scrim({ children, className, initial, animate, exit, ...rest }: MotionSheetProps) {
  const reduce = useReducedMotion()
  const variants = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: FADE },
        exit: { opacity: 0, transition: FADE },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: SPRING },
        exit: { opacity: 0, transition: SPRING },
      }

  return (
    <motion.div
      className={className}
      initial={initial ?? variants.initial}
      animate={animate ?? variants.animate}
      exit={exit ?? variants.exit}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function Sheet({ children, className, initial, animate, exit, ...rest }: MotionSheetProps) {
  const reduce = useReducedMotion()
  const variants = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: FADE },
        exit: { opacity: 0, transition: FADE },
      }
    : {
        initial: { opacity: 0, scale: 0.96, y: 8 },
        animate: { opacity: 1, scale: 1, y: 0, transition: SPRING },
        exit: { opacity: 0, scale: 0.96, y: 8, transition: SPRING },
      }

  return (
    <motion.div
      className={className}
      initial={initial ?? variants.initial}
      animate={animate ?? variants.animate}
      exit={exit ?? variants.exit}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
