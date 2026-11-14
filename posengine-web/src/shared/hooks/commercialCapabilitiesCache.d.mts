export function getOrLoadCommercialCapabilities<T>(
  key: string,
  loader: () => Promise<T>,
  now?: () => number,
): Promise<T>

export function invalidateCommercialCapabilities(key?: string): void
