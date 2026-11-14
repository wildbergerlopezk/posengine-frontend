import assert from "node:assert/strict"
import test from "node:test"
import JsBarcode from "jsbarcode"
import { assessCode128, CODE128_MODULE_WIDTH_MM, MIN_CODE128_MODULE_WIDTH_MM } from "./code128.ts"
import { LABEL_FORMATS } from "../data/label-formats.ts"

test("accepts numeric and alphanumeric barcodes as Code 128", () => {
  assert.equal(assessCode128("1234567890", 54).status, "ready")
  assert.equal(assessCode128("AB12-XY", 54).status, "ready")
})

test("preserves and assesses leading zeroes as part of the exact value", () => {
  const withZeroes = assessCode128("00012345", 54)
  const encoded = {}
  JsBarcode(encoded, "00012345", { format: "CODE128", displayValue: false })
  assert.equal(withZeroes.status, "ready")
  assert.equal(withZeroes.moduleCount, 99)
  assert.equal(encoded.encodings[0].text, "00012345")
})

test("fits the sample barcode in the real small-label content width", () => {
  const sample = "C128-QA-000100"
  const assessment = assessCode128(sample, LABEL_FORMATS[0].barcodeAvailableWidthMm)
  const encoded = {}
  JsBarcode(encoded, sample, {
    format: "CODE128",
    width: 1,
    height: 24,
    displayValue: false,
    margin: 0,
    marginLeft: 10,
    marginRight: 10,
    marginTop: 0,
    marginBottom: 0,
  })

  assert.equal(encoded.encodings[0].text, sample)
  assert.equal(encoded.encodings[0].data.length, 167)
  assert.equal(assessment.status, "ready")
  if (assessment.status === "ready") {
    assert.equal(assessment.moduleCount, 187)
    assert.equal(assessment.moduleWidthMm, CODE128_MODULE_WIDTH_MM)
    assert.ok(Math.abs(assessment.widthMm - 44.88) < 1e-9)
    assert.ok(Math.abs(assessment.heightMm - 5.76) < 1e-9)
    assert.ok(assessment.widthMm <= LABEL_FORMATS[0].barcodeAvailableWidthMm)
  }
})

test("shrinks modules only as needed and rejects symbols below the 0.20 mm floor", () => {
  const sample = "C128-QA-000100"
  const compact = assessCode128(sample, 44)
  const minimum = assessCode128(sample, 37.4)
  const tooNarrow = assessCode128(sample, 37.39)

  assert.equal(compact.status, "ready")
  if (compact.status === "ready") {
    assert.ok(compact.moduleWidthMm < CODE128_MODULE_WIDTH_MM)
    assert.ok(compact.moduleWidthMm >= MIN_CODE128_MODULE_WIDTH_MM)
    assert.ok(compact.widthMm <= 44)
  }

  assert.equal(minimum.status, "ready")
  if (minimum.status === "ready") {
    assert.equal(minimum.moduleWidthMm, MIN_CODE128_MODULE_WIDTH_MM)
    assert.ok(Math.abs(minimum.widthMm - 37.4) < 1e-9)
  }

  assert.deepEqual(tooNarrow, { status: "too-wide", moduleCount: 187, minWidthMm: 37.4 })
})

test("accepts a long value only when the minimum module width remains available", () => {
  const longNumeric = assessCode128("1234567890".repeat(5), 82)
  assert.equal(longNumeric.status, "ready")
  if (longNumeric.status === "ready") {
    assert.ok(longNumeric.moduleWidthMm >= MIN_CODE128_MODULE_WIDTH_MM)
    assert.ok(Math.abs(longNumeric.widthMm / longNumeric.moduleCount - longNumeric.moduleWidthMm) < 1e-9)
    assert.ok(Math.abs(longNumeric.heightMm / 24 - longNumeric.moduleWidthMm) < 1e-9)
  }
  assert.equal(assessCode128("A".repeat(50), 54).status, "too-wide")
})

test("missing and unsupported values are not substituted or encoded", () => {
  assert.deepEqual(assessCode128(undefined, 54), { status: "empty" })
  assert.deepEqual(assessCode128("", 54), { status: "empty" })
  assert.deepEqual(assessCode128("código-é", 82), { status: "unsupported", reason: "characters" })
})

test("uses a legible module width for the 50 mm and 90 mm labels", () => {
  const small = assessCode128("00012345", 54)
  const large = assessCode128("00012345", 82)
  assert.equal(small.status, "ready")
  assert.equal(large.status, "ready")
  if (small.status === "ready" && large.status === "ready") {
    assert.ok(small.moduleWidthMm >= MIN_CODE128_MODULE_WIDTH_MM)
    assert.equal(small.widthMm, large.widthMm)
    assert.equal(small.heightMm, large.heightMm)
  }
})
