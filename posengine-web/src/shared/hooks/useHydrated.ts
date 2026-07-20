import { useSyncExternalStore } from "react"

function subscribe(callback: () => void) {
  const timeoutId = window.setTimeout(callback, 0)
  return () => window.clearTimeout(timeoutId)
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
