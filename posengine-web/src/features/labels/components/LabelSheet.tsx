import type { CSSProperties } from "react"
import type { LabelCopy, LabelFormat, LabelGrid } from "../types/label.types"
import { ProductLabel } from "./ProductLabel"
import styles from "../labels.module.css"

interface LabelSheetProps {
  format: LabelFormat
  grid: LabelGrid
  labels: LabelCopy[]
  pageNumber: number
  isLastPage?: boolean
}

export function LabelSheet({ format, grid, labels, pageNumber, isLastPage = false }: LabelSheetProps) {
  const sheetStyle = {
    "--label-columns": grid.columns,
    "--label-width": `${format.widthMm}mm`,
    "--label-height": `${format.heightMm}mm`,
    "--sheet-margin": `${grid.marginMm}mm`,
    "--label-gap": `${grid.gapMm}mm`,
  } as CSSProperties

  return (
    <div
      className={`${styles.sheet} ${styles.labelSheet} ${isLastPage ? styles.lastPrintSheet : ""}`}
      aria-label={`Hoja de 20 por 30 cm ${pageNumber}, ${labels.length} etiquetas`}
      data-print-page={pageNumber}
      style={sheetStyle}
    >
      {labels.map((product) => (
        <ProductLabel
          key={`${product.id}-${product.copyIndex}`}
          product={product}
          format={format}
        />
      ))}
    </div>
  )
}
