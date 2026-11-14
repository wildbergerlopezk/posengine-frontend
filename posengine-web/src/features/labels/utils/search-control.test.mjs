import assert from "node:assert/strict"
import test from "node:test"
import { isLatestSearchRequest, scheduleDebouncedSearch } from "./search-control.ts"

test("debounce cancels prior searches and runs only the latest scheduled callback", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const calls = []
  const cancelOld = scheduleDebouncedSearch(() => calls.push("old"), 300)
  cancelOld()
  scheduleDebouncedSearch(() => calls.push("latest"), 300)

  context.mock.timers.tick(299)
  assert.deepEqual(calls, [])
  context.mock.timers.tick(1)
  assert.deepEqual(calls, ["latest"])
})

test("only a non-aborted response for the latest request may update results", () => {
  const activeRequest = new AbortController()
  assert.equal(isLatestSearchRequest(2, 2, activeRequest.signal), true)
  assert.equal(isLatestSearchRequest(1, 2, activeRequest.signal), false)

  activeRequest.abort()
  assert.equal(isLatestSearchRequest(2, 2, activeRequest.signal), false)
})

test("a slower obsolete search response cannot overwrite the newer result", async () => {
  let latestRequestId = 1
  let displayedResult = ""
  const slowController = new AbortController()
  let finishSlow
  const slowResponse = new Promise((resolve) => { finishSlow = resolve })
  const acceptResponse = async (requestId, controller, response) => {
    const result = await response
    if (isLatestSearchRequest(requestId, latestRequestId, controller.signal)) {
      displayedResult = result
    }
  }

  const slowRequest = acceptResponse(1, slowController, slowResponse)
  latestRequestId = 2
  const fastController = new AbortController()
  await acceptResponse(2, fastController, Promise.resolve("latest result"))
  finishSlow("obsolete result")
  await slowRequest

  assert.equal(displayedResult, "latest result")
})
