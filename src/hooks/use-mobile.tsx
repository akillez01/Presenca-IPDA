import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // No app Android (Capacitor), sempre tratamos como mobile para usar drawer (Sheet)
    // e evitar casos em que o viewport fica grande e o menu some.
    const isCapacitorNative =
      typeof window !== "undefined" &&
      Boolean((window as any).Capacitor?.isNativePlatform?.() || (window as any).Capacitor)
    if (isCapacitorNative) {
      setIsMobile(true)
      return
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    // Alguns WebViews antigos ainda usam addListener/removeListener.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
    } else if (typeof (mql as any).addListener === "function") {
      ;(mql as any).addListener(onChange)
    }
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onChange)
      } else if (typeof (mql as any).removeListener === "function") {
        ;(mql as any).removeListener(onChange)
      }
    }
  }, [])

  return !!isMobile
}
