import JsBarcode from "jsbarcode"

export const MIN_CODE128_MODULE_WIDTH_MM = 0.2
export const CODE128_MODULE_WIDTH_MM = 0.24
export const CODE128_BAR_HEIGHT_MODULES = 24
export const CODE128_QUIET_ZONE_MODULES = 10

const CODE128_OPTIONS = {
  format: "CODE128",
  width: 1,
  height: CODE128_BAR_HEIGHT_MODULES,
  displayValue: false,
  margin: 0,
  marginLeft: 10,
  marginRight: 10,
  marginTop: 0,
  marginBottom: 0,
} as const

export type Code128Assessment =
  | { status: "empty" }
  | { status: "unsupported"; reason: "characters" }
  | { status: "too-wide"; moduleCount: number; minWidthMm: number }
  | { status: "ready"; moduleCount: number; moduleWidthMm: number; widthMm: number; heightMm: number }

/** Assesses the exact stored value without trimming, normalizing, or converting it. */
export function assessCode128(value: string | undefined, availableWidthMm: number): Code128Assessment {
  if (!value) return { status: "empty" }

  // Control characters and non-ASCII characters are not supported by this label flow.
  if (!/^[\x20-\x7e]+$/.test(value)) return { status: "unsupported", reason: "characters" }

  const encoded: { encodings?: Array<{ data: string }> } = {}
  try {
    JsBarcode(encoded, value, CODE128_OPTIONS)
  } catch {
    return { status: "unsupported", reason: "characters" }
  }

  const dataModules = encoded.encodings?.reduce((total, item) => total + item.data.length, 0)
  if (!dataModules) return { status: "unsupported", reason: "characters" }

  // `data` includes start, checksum, and stop patterns. Add JsBarcode's two
  // 10-module quiet zones to get the full physical symbol width.
  const moduleCount = dataModules + CODE128_QUIET_ZONE_MODULES * 2
  const minWidthMm = moduleCount * MIN_CODE128_MODULE_WIDTH_MM
  const availableModuleWidthMm = availableWidthMm / moduleCount
  if (!Number.isFinite(availableModuleWidthMm) || availableModuleWidthMm + 1e-10 < MIN_CODE128_MODULE_WIDTH_MM) {
    return { status: "too-wide", moduleCount, minWidthMm }
  }

  // Retain the standard 0.24 mm module where possible; only shrink to the
  // documented 0.20 mm floor when the physical label width requires it.
  const moduleWidthMm = Math.min(CODE128_MODULE_WIDTH_MM, Math.max(MIN_CODE128_MODULE_WIDTH_MM, availableModuleWidthMm))
  const widthMm = moduleCount * moduleWidthMm
  const heightMm = CODE128_BAR_HEIGHT_MODULES * moduleWidthMm

  return { status: "ready", moduleCount, moduleWidthMm, widthMm, heightMm }
}

export function renderCode128(svg: SVGSVGElement, value: string): void {
  JsBarcode(svg, value, CODE128_OPTIONS)
}
