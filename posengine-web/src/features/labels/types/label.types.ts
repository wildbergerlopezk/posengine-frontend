export type LabelFormatId = "small" | "large"

export interface LabelFormat {
  id: LabelFormatId
  name: string
  widthMm: number
  heightMm: number
  barcodeAvailableWidthMm: number
  detail: string
}

export interface LabelProduct {
  id: string
  name: string
  sku?: string
  barcode?: string
  imageUrl?: string
  description?: string
  price: number
}

export interface SelectedLabelProduct extends LabelProduct {
  quantity: number
}

export interface LabelCopy extends LabelProduct {
  copyIndex: number
}

export interface LabelGrid {
  columns: number
  rows: number
  capacity: number
  widthMm: number
  heightMm: number
  marginMm: number
  gapMm: number
}
