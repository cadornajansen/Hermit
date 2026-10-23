"use client"

import { useAnimate, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef, type ReactElement, type ReactNode } from "react"

export function LandingReveal({
  children,
  className,
  scale = false,
}: {
  children: ReactNode
  className?: string
  scale?: boolean
}): ReactElement {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const inView = useInView(scope, { once: true, amount: 0.15 })
  const reduceMotion = useReducedMotion()
  const played = useRef(false)

  useEffect(() => {
    if (!inView || reduceMotion !== false || played.current) return
    played.current = true

    // Start keyframes only in the browser; server HTML stays visible without JS.
    const controls = animate(
      scope.current,
      { opacity: [0.65, 1], y: [12, 0], scale: scale ? [0.99, 1] : [1, 1] },
      { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
    )

    // Finish immediately if reduced motion is enabled during a reveal.
    return () => controls.complete()
  }, [animate, inView, reduceMotion, scale, scope])

  return (
    <div ref={scope} className={className} data-landing-reveal="">
      {children}
    </div>
  )
}
