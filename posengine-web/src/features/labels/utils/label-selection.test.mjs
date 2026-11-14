import assert from "node:assert/strict"
import test from "node:test"
import {
  addSelectedProduct,
  parseLabelQuantity,
  parseLabelQuantityDraft,
  removeSelectedProduct,
  updateSelectedProductQuantity,
} from "./label-selection.ts"

const product = { id: "p-1", name: "Filtro", sku: "FIL-1", price: 12000 }

test("accepts only positive integer label quantities up to the limit", () => {
  assert.equal(parseLabelQuantity(1), 1)
  assert.equal(parseLabelQuantity(1.5), null)
  assert.equal(parseLabelQuantity(0), null)
  assert.equal(parseLabelQuantity(201), null)
})

test("parses temporary text input only when it contains a valid final quantity", () => {
  assert.equal(parseLabelQuantityDraft("30"), 30)
  assert.equal(parseLabelQuantityDraft("5"), 5)
  assert.equal(parseLabelQuantityDraft("200"), 200)
  assert.equal(parseLabelQuantityDraft(""), null)
  assert.equal(parseLabelQuantityDraft("0"), null)
  assert.equal(parseLabelQuantityDraft("-1"), null)
  assert.equal(parseLabelQuantityDraft("201"), null)
  assert.equal(parseLabelQuantityDraft("2.5"), null)
})

test("adds products once and increases the existing selected quantity", () => {
  const once = addSelectedProduct([], product, 2)
  const twice = addSelectedProduct(once, product, 3)
  assert.equal(twice.length, 1)
  assert.equal(twice[0].quantity, 5)
})

test("updates and removes selected products by ID", () => {
  const selected = addSelectedProduct([], product, 1)
  assert.equal(updateSelectedProductQuantity(selected, "p-1", 4)[0].quantity, 4)
  assert.deepEqual(removeSelectedProduct(selected, "p-1"), [])
})
