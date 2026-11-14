import assert from "node:assert/strict"
import test from "node:test"
import { LABEL_FORMATS } from "../data/label-formats.ts"
import { createLabelDocument } from "./label-document.ts"

const small = LABEL_FORMATS.find(({ id }) => id === "small")
const large = LABEL_FORMATS.find(({ id }) => id === "large")

function selected(id, quantity, overrides = {}) {
  return {
    id,
    name: `Producto ${id}`,
    sku: `SKU-${id}`,
    barcode: id === "without-barcode" ? undefined : "00012345",
    price: 25000,
    quantity,
    ...overrides,
  }
}

test("print document shares one 20 × 30 cm sheet for a single label", () => {
  const document = createLabelDocument([selected("one", 1)], small)
  assert.equal(document.pages.length, 1)
  assert.equal(document.pages[0].length, 1)
  assert.equal(document.totalLabels, 1)
  assert.deepEqual(document.pages[0][0].barcode, "00012345")
})

test("one completely filled sheet contains exactly 60 small labels or 20 large labels", () => {
  const smallDocument = createLabelDocument([selected("small-full", 60)], small)
  const largeDocument = createLabelDocument([selected("large-full", 20)], large)

  assert.deepEqual(smallDocument.pages.map(({ length }) => length), [60])
  assert.deepEqual(largeDocument.pages.map(({ length }) => length), [20])
})

test("small format holds 60 labels and paginates 100 across two sheets", () => {
  const document = createLabelDocument([selected("small", 100)], small)
  assert.equal(document.grid.capacity, 60)
  assert.deepEqual(document.pages.map(({ length }) => length), [60, 40])
})

test("large format holds 20 labels and paginates 100 across five sheets", () => {
  const document = createLabelDocument([selected("large", 100)], large)
  assert.equal(document.grid.capacity, 20)
  assert.equal(document.grid.marginMm, 0)
  assert.deepEqual(document.pages.map(({ length }) => length), [20, 20, 20, 20, 20])
})

test("200 labels paginate without blank or partial middle sheets", () => {
  const document = createLabelDocument([selected("small", 200)], small)
  assert.deepEqual(document.pages.map(({ length }) => length), [60, 60, 60, 20])
  assert.equal(document.pages.flat().length, 200)
})

test("mixed product quantities keep order, prices, images, and optional barcodes", () => {
  const document = createLabelDocument([
    selected("first", 2, { imageUrl: "https://example.test/item.png" }),
    selected("without-barcode", 1, { sku: "TEXT-ONLY", barcode: undefined }),
  ], large)

  assert.deepEqual(document.pages[0].map(({ id }) => id), ["first", "first", "without-barcode"])
  assert.equal(document.pages[0][0].imageUrl, "https://example.test/item.png")
  assert.equal(document.pages[0][2].barcode, undefined)
  assert.equal(document.pages[0][2].sku, "TEXT-ONLY")
  assert.equal(document.pages[0][0].price, 25000)
})

test("empty selections produce no printable pages", () => {
  const document = createLabelDocument([], small)
  assert.equal(document.totalLabels, 0)
  assert.deepEqual(document.pages, [])
})
