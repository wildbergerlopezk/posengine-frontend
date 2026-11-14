import assert from "node:assert/strict"
import test from "node:test"
import { labelDraftScopeKey, matchesLabelDraftScope, sanitizeLabelDraftProducts } from "./label-draft.ts"

test("label drafts are scoped to both user and tenant", () => {
  const first = labelDraftScopeKey("user-1", "tenant-1")
  assert.equal(matchesLabelDraftScope(first, labelDraftScopeKey("user-1", "tenant-1")), true)
  assert.equal(matchesLabelDraftScope(first, labelDraftScopeKey("user-2", "tenant-1")), false)
  assert.equal(matchesLabelDraftScope(first, labelDraftScopeKey("user-1", "tenant-2")), false)
})

test("draft recovery removes invalid rows and deduplicates product ids", () => {
  const result = sanitizeLabelDraftProducts([
    { id: "p1", name: "Producto", quantity: 3, price: 100, sku: "SKU-1", imageUrl: "/p1.png" },
    { id: "p1", name: "Producto actualizado", quantity: 2, price: 120, barcode: "0001" },
    { id: "bad", name: "Cantidad decimal", quantity: 1.5, price: 1 },
    { id: "unsafe", name: "Precio inválido", quantity: 1, price: Number.NaN },
    null,
  ])

  assert.equal(result.length, 2)
  assert.equal(result[0].id, "p1")
  assert.equal(result[0].quantity, 5)
  assert.equal(result[0].price, 120)
  assert.equal(result[0].barcode, "0001")
  assert.equal(result[0].sku, undefined)
  assert.equal(result[1].price, 0)
})

test("draft recovery caps quantities and excludes render-only data", () => {
  const [product] = sanitizeLabelDraftProducts([
    { id: "p1", name: "Producto", quantity: 500, price: 10, svg: "<svg />", pdf: new Uint8Array([1]) },
  ])

  assert.equal(product.quantity, 200)
  assert.equal("svg" in product, false)
  assert.equal("pdf" in product, false)
})
