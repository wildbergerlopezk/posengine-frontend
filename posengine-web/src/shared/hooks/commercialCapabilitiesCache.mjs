const CACHE_TTL_MS = 30_000
const values = new Map()
const requests = new Map()
const generations = new Map()
let globalGeneration = 0

export function getOrLoadCommercialCapabilities(key, loader, now = Date.now) {
  const cached = values.get(key)
  if (cached && cached.expiresAt > now()) return Promise.resolve(cached.value)

  const pending = requests.get(key)
  if (pending) return pending.promise

  const generation = generations.get(key) ?? 0
  const requestGeneration = globalGeneration
  const promise = Promise.resolve().then(loader).then(value => {
    if (globalGeneration === requestGeneration && (generations.get(key) ?? 0) === generation) {
      values.set(key, { value, expiresAt: now() + CACHE_TTL_MS })
    }
    return value
  }).finally(() => {
    if (requests.get(key)?.promise === promise) requests.delete(key)
  })

  requests.set(key, { promise })
  return promise
}

export function invalidateCommercialCapabilities(key) {
  if (key === undefined) {
    globalGeneration += 1
    values.clear()
    requests.clear()
    return
  }

  values.delete(key)
  requests.delete(key)
  generations.set(key, (generations.get(key) ?? 0) + 1)
}
