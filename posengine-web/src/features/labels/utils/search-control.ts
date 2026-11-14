export function scheduleDebouncedSearch(callback: () => void, delayMs: number): () => void {
  let cancelled = false
  const timer = setTimeout(() => {
    if (!cancelled) callback()
  }, delayMs)

  return () => {
    cancelled = true
    clearTimeout(timer)
  }
}

export function isLatestSearchRequest(
  requestId: number,
  latestRequestId: number,
  signal: AbortSignal,
): boolean {
  return !signal.aborted && requestId === latestRequestId
}
