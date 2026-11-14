"use client"

import { Fragment, useRef, useEffect, useState } from "react"
import { Search, X, User, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import styles from "./CustomerSearchModal.module.css"

export interface CustomerSearchItem {
  id: string
  name: string
  documentNumber?: string
  creditLimit: number
  currentDebt: number
  creditEnabled: boolean
}

interface CustomerSearchModalProps {
  open: boolean
  customers: CustomerSearchItem[]
  totalItems: number
  page: number
  loading?: boolean
  searchValue: string
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  onSelect: (customer: CustomerSearchItem | null) => void
  onClose: () => void
}

const LIMIT = 10

export function CustomerSearchModal({
  open,
  customers,
  totalItems,
  page,
  loading = false,
  searchValue,
  onSearchChange,
  onPageChange,
  onSelect,
  onClose,
}: CustomerSearchModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const totalPages = Math.ceil(totalItems / LIMIT)
  const pageCustomers = customers
  const pageNumbers = Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b)

  // "Consumidor Final" es una fila más al final de la lista, navegable con flechas
  const totalRows = pageCustomers.length + 1
  const isConsumerFinalSelected = selectedIndex === pageCustomers.length

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchValue, customers])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % totalRows)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + totalRows) % totalRows)
      } else if (e.key === "ArrowRight" && e.ctrlKey) {
        if (page < totalPages) {
          e.preventDefault()
          onPageChange(page + 1)
          setSelectedIndex(0)
        }
      } else if (e.key === "ArrowLeft" && e.ctrlKey) {
        if (page > 1) {
          e.preventDefault()
          onPageChange(page - 1)
          setSelectedIndex(0)
        }
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (loading) return
        if (isConsumerFinalSelected) {
          onSelect(null)
        } else if (pageCustomers[selectedIndex]) {
          onSelect(pageCustomers[selectedIndex])
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, pageCustomers, selectedIndex, totalRows, isConsumerFinalSelected, onSelect, onClose, page, totalPages, onPageChange, loading])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div data-pos-modal className={styles.modal} onClick={(e) => e.stopPropagation()}>

        <div className={styles.header}>
          <h3 className={styles.title}>Buscar Cliente (F8)</h3>
          <button className={styles.closeBtn} onClick={onClose} title="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        <div className={styles.searchBox}>
          <Search size={20} className={styles.searchIcon} />
          <input
            ref={searchRef}
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por nombre, CI, RUC..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className={styles.listWrapper}>
          {loading ? (
            <div className={styles.emptyState} role="status" aria-live="polite">
              <Loader2 size={24} className={styles.spinner} />
              <span>Buscando clientes…</span>
            </div>
          ) : pageCustomers.length > 0 ? (
            pageCustomers.map((c, index) => {
              const available = Math.max(0, c.creditLimit - c.currentDebt)
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.row} ${index === selectedIndex ? styles.rowSelected : ""}`}
                  onClick={() => onSelect(c)}
                >
                  <div className={styles.avatar}>
                    <User size={18} />
                  </div>

                  <div className={styles.customerInfo}>
                    <span className={styles.customerName}>{c.name}</span>
                    <span className={styles.customerDoc}>Doc: {c.documentNumber || "—"}</span>
                  </div>

                  <div className={styles.rightCol}>
                    <span className={styles.availableText}>
                      Disponible: <span className={styles.availableValue}>{formatCurrency(available)}</span>
                    </span>
                    {c.creditEnabled ? (
                      <span className={`${styles.creditBadge} ${styles.creditOn}`}>Crédito Activo</span>
                    ) : (
                      <span className={`${styles.creditBadge} ${styles.creditOff}`}>Solo Contado</span>
                    )}
                  </div>
                </button>
              )
            })
          ) : (
            <div className={styles.emptyState}>
              <User size={40} style={{ opacity: 0.3 }} />
              <span>No se encontraron clientes.</span>
            </div>
          )}

          {/* Consumidor Final — alcanzable con flechas + Enter */}
          <button
            type="button"
            className={`${styles.row} ${styles.consumerRow} ${isConsumerFinalSelected ? styles.rowSelected : ""}`}
            onClick={() => onSelect(null)}
          >
            <div className={styles.avatar}>
              <User size={18} />
            </div>
            <div className={styles.customerInfo}>
              <span className={styles.consumerLabel}>Consumidor Final</span>
            </div>
            <div />
          </button>
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, totalItems)} de {totalItems}
            </span>
            <div className={styles.paginationControls}>
              <button
                className={styles.pageBtn}
                disabled={page === 1}
                onClick={() => {
                  onPageChange(page - 1)
                  setSelectedIndex(0)
                }}
              >
                <ChevronLeft size={14} />
              </button>
              {pageNumbers.map((p, index) => (
                <Fragment key={p}>
                  {index > 0 && p - pageNumbers[index - 1] > 1 && <span className={styles.pageBtn}>…</span>}
                  <button
                    className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ""}`}
                    onClick={() => {
                      onPageChange(p)
                      setSelectedIndex(0)
                    }}
                  >
                    {p}
                  </button>
                </Fragment>
              ))}
              <button
                className={styles.pageBtn}
                disabled={page === totalPages}
                onClick={() => {
                  onPageChange(page + 1)
                  setSelectedIndex(0)
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.hints}>
            <kbd className={styles.kbd}>↑↓</kbd> Navegar
            <kbd className={styles.kbd}>Ctrl + ← / →</kbd> Pág
            <kbd className={styles.kbd}>Enter</kbd> Seleccionar
            <kbd className={styles.kbd}>Esc</kbd> Cerrar
          </div>
        </div>

      </div>
    </div>
  )
}


