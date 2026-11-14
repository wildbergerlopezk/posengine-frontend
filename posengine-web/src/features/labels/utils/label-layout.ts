import type { LabelCopy, LabelFormat, LabelGrid, SelectedLabelProduct } from "../types/label.types"

export const LABEL_SHEET = {
  widthMm: 200,
  heightMm: 300,
  // These real label sheets are cut edge-to-edge; zero margins/gaps preserve 20/60 capacity.
  marginMm: 0,
  gapMm: 0,
} as const

export function calculateLabelGrid(format: LabelFormat): LabelGrid {
  const availableWidth = LABEL_SHEET.widthMm - LABEL_SHEET.marginMm * 2
  const availableHeight = LABEL_SHEET.heightMm - LABEL_SHEET.marginMm * 2
  const columns = Math.floor((availableWidth + LABEL_SHEET.gapMm) / (format.widthMm + LABEL_SHEET.gapMm))
  const rows = Math.floor((availableHeight + LABEL_SHEET.gapMm) / (format.heightMm + LABEL_SHEET.gapMm))

  if (columns < 1 || rows < 1) {
    throw new RangeError("El formato de etiqueta no cabe en una hoja de 20 × 30 cm")
  }

  return {
    columns,
    rows,
    capacity: columns * rows,
    widthMm: LABEL_SHEET.widthMm,
    heightMm: LABEL_SHEET.heightMm,
    marginMm: LABEL_SHEET.marginMm,
    gapMm: LABEL_SHEET.gapMm,
  }
}

export function createLabelCopies(selected: SelectedLabelProduct[]): LabelCopy[] {
  return selected.flatMap((product) => {
    if (!Number.isInteger(product.quantity) || product.quantity < 0) {
      throw new RangeError(`La cantidad de etiquetas de ${product.name} debe ser un entero no negativo`)
    }

    return Array.from({ length: product.quantity }, (_, index) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      imageUrl: product.imageUrl,
      description: product.description,
      price: product.price,
      copyIndex: index + 1,
    }))
  })
}

export function paginateLabelCopies(copies: LabelCopy[], capacity: number): LabelCopy[][] {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError("La capacidad por hoja debe ser un entero positivo")
  }

  const pages: LabelCopy[][] = []
  for (let offset = 0; offset < copies.length; offset += capacity) {
    pages.push(copies.slice(offset, offset + capacity))
  }
  return pages
}
