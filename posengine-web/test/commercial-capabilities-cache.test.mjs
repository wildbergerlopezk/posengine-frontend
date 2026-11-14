import assert from "node:assert/strict"
import test from "node:test"
import {
  getOrLoadCommercialCapabilities,
  invalidateCommercialCapabilities,
} from "../src/shared/hooks/commercialCapabilitiesCache.mjs"

test("shares a single in-flight request for the same session", async () => {
  invalidateCommercialCapabilities()
  let calls = 0
  let release
  const loader = () => {
    calls += 1
    return new Promise(resolve => { release = resolve })
  }

  const first = getOrLoadCommercialCapabilities("user-a:tenant-a", loader)
  const second = getOrLoadCommercialCapabilities("user-a:tenant-a", loader)
  await Promise.resolve()
  assert.equal(calls, 1)
  release({ saleReturns: { enabled: true, reason: null } })
  assert.deepEqual(await first, await second)
})

test("isolates sessions and expires cached capabilities after the TTL", async () => {
  invalidateCommercialCapabilities()
  let now = 100
  let calls = 0
  const loader = async () => ({ value: ++calls })
  assert.deepEqual(await getOrLoadCommercialCapabilities("a:tenant", loader, () => now), { value: 1 })
  assert.deepEqual(await getOrLoadCommercialCapabilities("b:tenant", loader, () => now), { value: 2 })
  assert.deepEqual(await getOrLoadCommercialCapabilities("a:tenant", loader, () => now), { value: 1 })
  now += 30_001
  assert.deepEqual(await getOrLoadCommercialCapabilities("a:tenant", loader, () => now), { value: 3 })
})

test("invalidation prevents an older in-flight response from repopulating the cache", async () => {
  invalidateCommercialCapabilities()
  let release
  const stale = getOrLoadCommercialCapabilities("user:tenant", () => new Promise(resolve => { release = resolve }))
  await Promise.resolve()
  invalidateCommercialCapabilities("user:tenant")
  release({ value: "stale" })
  await stale
  assert.deepEqual(
    await getOrLoadCommercialCapabilities("user:tenant", async () => ({ value: "fresh" })),
    { value: "fresh" },
  )
})
