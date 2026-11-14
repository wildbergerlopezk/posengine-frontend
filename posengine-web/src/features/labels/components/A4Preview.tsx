"use client"

import { ChevronLeft, ChevronRight, FileText, Printer } from "lucide-react"
import type { LabelCopy, LabelFormat } from "../types/label.types"
import { calculateLabelGrid } from "../utils/label-layout"
import { LabelSheet } from "./LabelSheet"
import styles from "../labels.module.css"

interface A4PreviewProps {
  format: LabelFormat
  pages: LabelCopy[][]
  pageIndex: number
  totalLabels: number
  isPreparingPrint: boolean
  printError: string | null
  onPrint: () => void
  onPageChange: (nextPage: number) => void
}

export function A4Preview({ format, pages, pageIndex, totalLabels, isPreparingPrint, printError, onPrint, onPageChange }: A4PreviewProps) {
  const grid = calculateLabelGrid(format)
  const page = pages[pageIndex] ?? []

  return (
    <section className={styles.previewCard} aria-labelledby="labels-preview-title">
      <div className={styles.previewHeader}>
        <div>
          <div className={styles.eyebrow}>COMPOSICIÓN DE IMPRESIÓN</div>
          <h2 id="labels-preview-title" className={styles.sectionTitle}>Vista previa 20 × 30 cm</h2>
          <p className={styles.previewMeta}>
            {format.widthMm} × {format.heightMm} mm · {grid.columns} columnas × {grid.rows} filas · {grid.capacity} por hoja · {totalLabels} etiquetas en {pages.length} hojas
          </p>
        </div>
        <div className={styles.previewActions}>
          <div className={styles.pagination} aria-label="Paginación de vista previa">
            <button
              className={styles.iconButton}
              type="button"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={pageIndex === 0 || pages.length === 0}
              aria-label="Ver hoja anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <span className={styles.pageCounter} aria-live="polite">
              Hoja {pages.length ? pageIndex + 1 : 0} de {pages.length}
            </span>
            <button
              className={styles.iconButton}
              type="button"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={pageIndex >= pages.length - 1 || pages.length === 0}
              aria-label="Ver hoja siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            type="button"
            className={styles.printButton}
            onClick={onPrint}
            disabled={pages.length === 0 || isPreparingPrint}
          >
            <Printer size={16} aria-hidden="true" />
            {isPreparingPrint ? "Abriendo impresión…" : "Imprimir / guardar PDF"}
          </button>
        </div>
      </div>

      <p className={styles.printInstructions}>
        Papel personalizado de 20 × 30 cm, sin márgenes ni separación para aprovechar el área completa. En Chrome, elegí 20 × 30 cm y escala 100 %; desactivá encabezados y pies. Verificá que la impresora permita impresión sin bordes antes de imprimir.
      </p>
      {printError && <p className={styles.printError} role="alert">{printError}</p>}

      <div className={styles.sheetViewport}>
        {page.length > 0 ? (
          <LabelSheet format={format} grid={grid} labels={page} pageNumber={pageIndex + 1} />
        ) : (
          <div className={styles.emptySheet}>
            <FileText size={28} />
            <strong>La hoja está vacía</strong>
            <span>Agregá productos para componer las etiquetas de prueba.</span>
          </div>
        )}
      </div>
    </section>
  )
}
