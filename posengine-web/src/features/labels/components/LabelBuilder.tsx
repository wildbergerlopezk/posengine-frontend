"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react"
import { Header } from "@/src/shared/components/Header"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { A4Preview } from "./A4Preview"
import { LabelPrintDocument } from "./LabelPrintDocument"
import { LabelProductPicker } from "./LabelProductPicker"
import { LABEL_FORMATS } from "../data/label-formats"
import { createLabelDocument } from "../utils/label-document"
import { labelDraftScopeKey } from "../utils/label-draft"
import { parseLabelQuantityDraft } from "../utils/label-selection"
import { hydrateLabelDraftForScope, useLabelDraftStore } from "../store/labelDraft.store"
import { assessCode128 } from "../utils/code128"
import type { LabelProduct } from "../types/label.types"
import type { LabelFormatId } from "../types/label.types"
import styles from "../labels.module.css"

export function LabelBuilder() {
  const user = useAuthStore((state) => state.user)
  const scopeKey = user ? labelDraftScopeKey(user.id, user.tenantId) : null
  const draftProducts = useLabelDraftStore((state) => state.selectedProducts)
  const draftFormatId = useLabelDraftStore((state) => state.formatId)
  const draftScopeKey = useLabelDraftStore((state) => state.scopeKey)
  const addDraftProduct = useLabelDraftStore((state) => state.addProduct)
  const setDraftQuantity = useLabelDraftStore((state) => state.setQuantity)
  const removeDraftProduct = useLabelDraftStore((state) => state.removeProduct)
  const clearDraft = useLabelDraftStore((state) => state.clearDraft)
  const setFormatId = useLabelDraftStore((state) => state.setFormatId)
  const [draftReady, setDraftReady] = useState(false)
  const [pageIndex, setPageIndex] = useState(0)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [isPreparingPrint, setIsPreparingPrint] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  const draftReadyForUser = draftReady && scopeKey === draftScopeKey
  const selectedProducts = draftReadyForUser ? draftProducts : []
  const formatId: LabelFormatId = draftReadyForUser ? draftFormatId : "small"
  const format = LABEL_FORMATS.find((item) => item.id === formatId) ?? LABEL_FORMATS[0]
  const labelDocument = useMemo(
    () => createLabelDocument(selectedProducts, format),
    [selectedProducts, format],
  )
  const { grid, pages, totalLabels } = labelDocument
  const identifierWarnings = useMemo(() => selectedProducts.flatMap((product) => {
    if (!product.barcode) {
      return [{
        id: product.id,
        message: product.sku
          ? `no tiene barcode. Se imprime el SKU “${product.sku}” como texto, pero Nueva venta no lo busca al escanear.`
          : "no tiene barcode ni SKU para identificarlo.",
      }]
    }

    const assessment = assessCode128(product.barcode, format.barcodeAvailableWidthMm)
    if (assessment.status === "unsupported") {
      return [{ id: product.id, message: "tiene un barcode con caracteres no compatibles con Code 128." }]
    }
    if (assessment.status === "too-wide") {
      return [{ id: product.id, message: "tiene un barcode demasiado largo para imprimirse con barras legibles en este formato." }]
    }
    return []
  }), [format.id, selectedProducts])

  useEffect(() => {
    let isCurrent = true
    setDraftReady(false)
    if (!scopeKey) return () => { isCurrent = false }

    void hydrateLabelDraftForScope(scopeKey).finally(() => {
      if (isCurrent) setDraftReady(true)
    })
    return () => { isCurrent = false }
  }, [scopeKey])

  useEffect(() => {
    if (!draftReadyForUser || selectedProducts.length === 0) return

    const warnBeforeLeavingTab = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeLeavingTab)
    return () => window.removeEventListener("beforeunload", warnBeforeLeavingTab)
  }, [draftReadyForUser, selectedProducts.length])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "F2" || event.repeat || isSearchOpen) return
      event.preventDefault()
      setIsSearchOpen(true)
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [isSearchOpen])

  const openPrintDialog = () => {
    if (pages.length === 0 || isPreparingPrint) return
    setPrintError(null)
    setIsPreparingPrint(true)

    window.requestAnimationFrame(() => {
      const pageStyle = document.createElement("style")
      pageStyle.dataset.labelsPrintPage = "true"
      pageStyle.textContent = "@page { size: 200mm 300mm; margin: 0; }"
      document.head.appendChild(pageStyle)

      void prepareAndPrint(pageStyle)
    })
  }

  const prepareAndPrint = async (pageStyle: HTMLStyleElement) => {
    const printRoot = document.querySelector<HTMLElement>("[data-label-print-root]")
    try {
      await nextFrame()
      await nextFrame()
      await document.fonts.ready

      if (printRoot) {
        const deadline = Date.now() + 2500
        while (Date.now() < deadline) {
          const pendingBarcodes = printRoot.querySelectorAll<SVGSVGElement>(
            '[data-code128-status="ready"] svg:not([data-code128-rendered="true"])',
          )
          if (pendingBarcodes.length === 0) break
          await nextFrame()
        }

        const pendingBarcodes = printRoot.querySelectorAll(
          '[data-code128-status="ready"] svg:not([data-code128-rendered="true"])',
        )
        if (pendingBarcodes.length > 0) {
          setPrintError("No se pudieron preparar algunos códigos de barras. Esperá un momento y volvé a imprimir.")
          return
        }

        await Promise.all(Array.from(printRoot.querySelectorAll("img"), (image) => image.decode().catch(() => undefined)))
      }

      window.print()
    } catch {
      setPrintError("No se pudo preparar el documento de impresión. Revisá la configuración del navegador e intentá de nuevo.")
    } finally {
      pageStyle.remove()
      setIsPreparingPrint(false)
    }
  }

  const addProduct = (product: LabelProduct, quantity: number) => {
    addDraftProduct(product, quantity)
    setPageIndex(0)
    setIsSearchOpen(false)
  }

  const updateSelectedQuantity = (productId: string, quantity: number) => {
    setDraftQuantity(productId, quantity)
    setPageIndex(0)
  }

  const removeProduct = (productId: string) => {
    removeDraftProduct(productId)
    setPageIndex(0)
  }

  return (
    <div className={styles.page}>
      <Header title="Etiquetas de productos" />

      {!draftReadyForUser ? (
        <div className={styles.pageContent} aria-live="polite">Recuperando el borrador de etiquetas…</div>
      ) : <>
      <div className={styles.pageContent}>
      <div className={styles.builderGrid}>
        <aside className={styles.controlsColumn} aria-label="Configuración de etiquetas">
          <section className={styles.card} aria-labelledby="format-title">
            <div className={styles.cardHeading}>
              <div>
                <div className={styles.eyebrow}>PASO 1</div>
                <h2 id="format-title" className={styles.sectionTitle}>Elegí un formato</h2>
              </div>
            </div>
            <div className={styles.formatOptions} role="group" aria-label="Formato de etiqueta">
              {LABEL_FORMATS.map((option) => {
                const isActive = option.id === formatId
                return (
                  <button
                    key={option.id}
                    className={`${styles.formatOption} ${isActive ? styles.formatOptionActive : ""}`}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setFormatId(option.id)
                      setPageIndex(0)
                    }}
                  >
                    <span className={styles.formatCheck}>{isActive && <Check size={13} />}</span>
                    <span className={styles.formatName}>{option.name}</span>
                    <span className={styles.formatDimensions}>{option.widthMm} × {option.heightMm} mm</span>
                    <span className={styles.formatDescription}>{option.detail}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className={styles.card} aria-labelledby="selection-title">
            <div className={styles.selectionHeading}>
              <div className={styles.selectionTitleRow}>
                <div className={styles.selectionTitle}>
                  <div className={styles.eyebrow}>PASO 2</div>
                  <h2 id="selection-title" className={styles.sectionTitle}>Productos de la hoja</h2>
                </div>
                <span className={styles.totalBadge}>{totalLabels} {totalLabels === 1 ? "etiqueta" : "etiquetas"}</span>
              </div>
              <div className={styles.selectionActions}>
                {selectedProducts.length > 0 && (
                  <button type="button" className={styles.clearLabelsButton} onClick={() => setIsClearDialogOpen(true)}>
                    <Trash2 size={14} aria-hidden="true" /> Limpiar
                  </button>
                )}
                <button type="button" className={styles.addProductButton} onClick={() => setIsSearchOpen(true)}>
                  <Plus size={16} aria-hidden="true" />
                  <span>Agregar <kbd>F2</kbd></span>
                </button>
              </div>
            </div>
            {selectedProducts.length ? (
              <ul className={styles.selectedList}>
                {selectedProducts.map((product) => (
                  <li className={styles.selectedProduct} key={product.id}>
                    <div className={styles.selectedProductInfo}>
                      <strong>{product.name}</strong>
                      <span>{product.barcode || product.sku || "Sin barcode ni SKU"}</span>
                    </div>
                    <label className={styles.quantityControl}>
                      <span className={styles.srOnly}>Cantidad de etiquetas para {product.name}</span>
                        <LabelQuantityInput
                          quantity={product.quantity}
                          onCommit={(quantity) => updateSelectedQuantity(product.id, quantity)}
                        />
                    </label>
                    <button
                      className={styles.removeButton}
                      type="button"
                      onClick={() => removeProduct(product.id)}
                      aria-label={`Quitar ${product.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptySelection}>Agregá uno o más productos para empezar la composición.</p>
            )}
            {identifierWarnings.length > 0 && (
              <div className={styles.identifierWarnings} role="status" aria-label="Advertencias de identificadores">
                <strong><AlertTriangle size={14} aria-hidden="true" /> Revisá estos identificadores antes de imprimir:</strong>
                <ul>
                  {identifierWarnings.map((warning) => {
                    const product = selectedProducts.find((item) => item.id === warning.id)
                    return <li key={warning.id}>{product?.name}: {warning.message}</li>
                  })}
                </ul>
              </div>
            )}
          </section>
        </aside>

        <A4Preview
          format={format}
          pages={pages}
          pageIndex={pageIndex}
          totalLabels={totalLabels}
          isPreparingPrint={isPreparingPrint}
          printError={printError}
          onPrint={openPrintDialog}
          onPageChange={setPageIndex}
        />
      </div>
      </div>
      <LabelPrintDocument format={format} grid={grid} pages={pages} />
      {isSearchOpen && (
        <LabelProductPicker
          selectedProducts={selectedProducts}
          onAdd={addProduct}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogPortal>
          <AlertDialogOverlay className={styles.discardDialogOverlay} />
          <AlertDialogPrimitive.Content data-pos-modal className={styles.discardDialogContent}>
            <AlertDialogHeader className={styles.discardDialogHeader}>
              <AlertDialogTitle className={styles.discardDialogTitle}>¿Descartar las etiquetas?</AlertDialogTitle>
              <AlertDialogDescription className={styles.discardDialogDescription}>
                Tenés etiquetas cargadas. Si continuás, se eliminará la composición actual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className={styles.discardDialogFooter}>
              <AlertDialogCancel className={styles.discardDialogCancel}>Cancelar</AlertDialogCancel>
              <AlertDialogAction className={styles.discardDialogAction} onClick={() => {
                clearDraft()
                setPageIndex(0)
                setIsClearDialogOpen(false)
              }}>
                Descartar etiquetas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogPrimitive.Content>
        </AlertDialogPortal>
      </AlertDialog>
      </>}
    </div>
  )
}

interface LabelQuantityInputProps {
  quantity: number
  onCommit: (quantity: number) => void
}

function LabelQuantityInput({ quantity, onCommit }: LabelQuantityInputProps) {
  const [value, setValue] = useState(String(quantity))
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!isEditing) setValue(String(quantity))
  }, [isEditing, quantity])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    setValue(nextValue)

    const parsed = parseLabelQuantityDraft(nextValue)
    if (parsed !== null) onCommit(parsed)
  }

  const finishEditing = () => {
    const parsed = parseLabelQuantityDraft(value)
    if (parsed === null) {
      setValue(String(quantity))
    } else {
      onCommit(parsed)
      setValue(String(parsed))
    }
    setIsEditing(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  return (
    <input
      className={styles.quantityInput}
      type="text"
      inputMode="numeric"
      value={value}
      onFocus={() => setIsEditing(true)}
      onChange={handleChange}
      onBlur={finishEditing}
      onKeyDown={handleKeyDown}
    />
  )
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
}
