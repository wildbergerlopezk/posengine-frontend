import type { LabelCopy, LabelFormat, LabelGrid } from "../types/label.types"
import { LabelSheet } from "./LabelSheet"
import styles from "../labels.module.css"

interface LabelPrintDocumentProps {
  format: LabelFormat
  grid: LabelGrid
  pages: LabelCopy[][]
}

export function LabelPrintDocument({ format, grid, pages }: LabelPrintDocumentProps) {
  if (pages.length === 0) return null

  return (
    <div className={styles.printRoot} aria-hidden="true" data-label-print-root>
      {pages.map((labels, index) => (
        <LabelSheet
          key={`print-sheet-${index + 1}`}
          format={format}
          grid={grid}
          labels={labels}
          pageNumber={index + 1}
          isLastPage={index === pages.length - 1}
        />
      ))}
    </div>
  )
}
