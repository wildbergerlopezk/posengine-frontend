import assert from "node:assert/strict"
import test from "node:test"

const values = new Map()
globalThis.sessionStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
  key: (index) => [...values.keys()][index] ?? null,
  get length() { return values.size },
}

const { clearLabelDraftOnLogout, hydrateLabelDraftForScope, LABEL_DRAFT_STORAGE_KEY, useLabelDraftStore } = await import("../store/labelDraft.store.ts")

test("label draft recovers selected products, quantities and format in the same session scope", async () => {
  await hydrateLabelDraftForScope('["tenant-a","user-a"]')
  useLabelDraftStore.getState().addProduct({ id: "p1", name: "Producto 1", price: 120, sku: "SKU-1", imageUrl: "/p1.png" }, 3)
  useLabelDraftStore.getState().addProduct({ id: "p2", name: "Producto 2", price: 250 }, 2)
  useLabelDraftStore.getState().setFormatId("large")

  assert.equal(JSON.parse(values.get(LABEL_DRAFT_STORAGE_KEY)).state.selectedProducts.length, 2)
  const sameScopeRecovered = await hydrateLabelDraftForScope('["tenant-a","user-a"]')
  assert.equal(sameScopeRecovered, true)
  assert.deepEqual(useLabelDraftStore.getState().selectedProducts.map(({ id, quantity }) => [id, quantity]), [["p1", 3], ["p2", 2]])
  assert.equal(useLabelDraftStore.getState().formatId, "large")
  assert.equal(useLabelDraftStore.getState().selectedProducts[0].imageUrl, "/p1.png")
})

test("a different user or tenant cannot recover the previous scope draft", async () => {
  const recovered = await hydrateLabelDraftForScope('["tenant-b","user-a"]')
  assert.equal(recovered, false)
  assert.deepEqual(useLabelDraftStore.getState().selectedProducts, [])
  assert.equal(useLabelDraftStore.getState().formatId, "small")

  useLabelDraftStore.getState().addProduct({ id: "p3", name: "Otro producto", price: 1 }, 1)
  const otherUserRecovered = await hydrateLabelDraftForScope('["tenant-b","user-b"]')
  assert.equal(otherUserRecovered, false)
  assert.deepEqual(useLabelDraftStore.getState().selectedProducts, [])
})

test("logout clears the in-memory and sessionStorage draft", () => {
  useLabelDraftStore.getState().addProduct({ id: "p4", name: "Producto", price: 1 }, 1)
  clearLabelDraftOnLogout()
  assert.deepEqual(useLabelDraftStore.getState().selectedProducts, [])
  assert.equal(values.has(LABEL_DRAFT_STORAGE_KEY), false)
})
