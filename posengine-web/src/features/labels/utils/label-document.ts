import type { LabelFormat, SelectedLabelProduct } from "../types/label.types"
import { calculateLabelGrid, createLabelCopies, paginateLabelCopies } from "./label-layout.ts"

export function createLabelDocument(selected: SelectedLabelProduct[], format: LabelFormat) {
  const grid = calculateLabelGrid(format)
  const copies = createLabelCopies(selected)
  const pages = paginateLabelCopies(copies, grid.capacity)

  return {
    format,
    grid,
    pages,
    totalLabels: copies.length,
  }
}
