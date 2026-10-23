"use client"

import { stagger, useAnimate, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef, type ReactElement, type ReactNode } from "react"

export function LandingReveal({
  children,
  className,
  staggerChildren = false,
}: {
  children: ReactNode
  className?: string
  staggerChildren?: boolean
}): ReactElement {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const inView = useInView(scope, { once: true, margin: "0px 0px 80px 0px" })
  const reduceMotion = useReducedMotion()
  const played = useRef(false)

  useEffect(() => {
    if (!inView || reduceMotion !== false || played.current) return
    played.current = true

    // Keep content visible: hydration must never fade already-painted text away.
    const controls = animate(
      staggerChildren ? Array.from(scope.current.children) : scope.current,
      { y: [8, 0] },
      {
        duration: 0.35,
        delay: staggerChildren ? stagger(0.06) : 0,
        ease: [0.22, 1, 0.36, 1],
      }
    )

    // Finish immediately if reduced motion is enabled during a reveal.
    return () => controls.complete()
  }, [animate, inView, reduceMotion, staggerChildren, scope])

  return (
    <div ref={scope} className={className} data-landing-reveal="">
      {children}
    </div>
  )
}
