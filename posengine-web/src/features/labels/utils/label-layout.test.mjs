import assert from "node:assert/strict"
import test from "node:test"
import { calculateLabelGrid, createLabelCopies, paginateLabelCopies } from "./label-layout.ts"

const small = { id: "small", name: "Pequeña", widthMm: 50, heightMm: 20, detail: "test" }
const large = { id: "large", name: "Grande", widthMm: 90, heightMm: 30, detail: "test" }

function product(id, name, quantity) {
  return { id, name, sku: `SKU-${id}`, price: 125000, quantity }
}

test("small labels fit 4 columns by 15 rows on a 20 × 30 cm sheet", () => {
  assert.deepEqual(calculateLabelGrid(small), {
    columns: 4,
    rows: 15,
    capacity: 60,
    widthMm: 200,
    heightMm: 300,
    marginMm: 0,
    gapMm: 0,
  })
})

test("large labels fit 2 columns by 10 rows on a 20 × 30 cm sheet", () => {
  assert.deepEqual(calculateLabelGrid(large), {
    columns: 2,
    rows: 10,
    capacity: 20,
    widthMm: 200,
    heightMm: 300,
    marginMm: 0,
    gapMm: 0,
  })
})

test("both format grids use the 20 × 30 cm sheet without crossing its edges", () => {
  for (const format of [small, large]) {
    const grid = calculateLabelGrid(format)
    const usedWidth = grid.columns * format.widthMm + (grid.columns - 1) * grid.gapMm
    const usedHeight = grid.rows * format.heightMm + (grid.rows - 1) * grid.gapMm
    assert.ok(usedWidth <= grid.widthMm - grid.marginMm * 2)
    assert.ok(usedHeight <= grid.heightMm - grid.marginMm * 2)
  }
})

test("one product repeats the requested number of labels", () => {
  const copies = createLabelCopies([product("a", "Producto A", 5)])
  assert.equal(copies.length, 5)
  assert.deepEqual(copies.map(({ copyIndex }) => copyIndex), [1, 2, 3, 4, 5])
})

test("three products keep their individual quantities and order", () => {
  const copies = createLabelCopies([
    product("a", "Producto A", 2),
    product("b", "Producto B", 3),
    product("c", "Producto C", 1),
  ])
  assert.deepEqual(copies.map(({ id }) => id), ["a", "a", "b", "b", "b", "c"])
})

test("products without a barcode remain printable with their real textual identifiers", () => {
  const selected = { id: "p-42", name: "Producto sin código", sku: "SKU-42", price: 95000, quantity: 1 }
  const [copy] = createLabelCopies([selected])
  assert.equal(copy.id, "p-42")
  assert.equal(copy.sku, "SKU-42")
  assert.equal(copy.barcode, undefined)
})

test("a full small sheet and overflow paginate without splitting labels", () => {
  const copies = createLabelCopies([product("full", "Producto", 61)])
  const pages = paginateLabelCopies(copies, calculateLabelGrid(small).capacity)
  assert.deepEqual(pages.map((page) => page.length), [60, 1])
  assert.equal(pages.flat().length, 61)
})

test("a full large sheet and overflow paginate without splitting labels", () => {
  const copies = createLabelCopies([product("large", "Producto", 21)])
  const pages = paginateLabelCopies(copies, calculateLabelGrid(large).capacity)
  assert.deepEqual(pages.map((page) => page.length), [20, 1])
})

test("mixed quantities paginate across sheets and retain long names", () => {
  const longName = "Filtro de aire universal para motocicleta urbana de uso diario"
  const copies = createLabelCopies([
    product("a", "Cadena reforzada", 30),
    product("b", longName, 28),
    product("c", "Lámpara LED", 10),
  ])
  const pages = paginateLabelCopies(copies, calculateLabelGrid(small).capacity)
  assert.deepEqual(pages.map((page) => page.length), [60, 8])
  assert.ok(pages.flat().some((copy) => copy.name === longName))
})

test("formats too large for the label sheet and invalid pagination inputs fail explicitly", () => {
  assert.throws(() => calculateLabelGrid({ ...large, widthMm: 220 }), RangeError)
  assert.throws(() => createLabelCopies([product("bad", "Cantidad decimal", 1.5)]), RangeError)
  assert.throws(() => paginateLabelCopies([], 0), RangeError)
})
