"use client"

import type React from "react"
import { useRef, useEffect, useState } from "react"
import { Search, X, User, ChevronLeft, ChevronRight } from "lucide-react"
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
  searchValue: string
  onSearchChange: (value: string) => void
  onSelect: (customer: CustomerSearchItem | null) => void
  onClose: () => void
}

const LIMIT = 10

export function CustomerSearchModal({
  open,
  customers,
  searchValue,
  onSearchChange,
  onSelect,
  onClose,
}: CustomerSearchModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [page, setPage] = useState(1)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = customers.filter((c) => {
    const s = searchValue.toLowerCase()
    return (
      c.name.toLowerCase().includes(s) ||
      (c.documentNumber && c.documentNumber.toLowerCase().includes(s))
    )
  })

  const totalItems = filtered.length
  const totalPages = Math.ceil(totalItems / LIMIT)
  const pageCustomers = filtered.slice((page - 1) * LIMIT, page * LIMIT)

  // "Consumidor Final" es una fila más al final de la lista, navegable con flechas
  const totalRows = pageCustomers.length + 1
  const isConsumerFinalSelected = selectedIndex === pageCustomers.length

  useEffect(() => {
    setSelectedIndex(0)
    setPage(1)
  }, [searchValue])

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
          setPage((p) => p + 1)
          setSelectedIndex(0)
        }
      } else if (e.key === "ArrowLeft" && e.ctrlKey) {
        if (page > 1) {
          e.preventDefault()
          setPage((p) => p - 1)
          setSelectedIndex(0)
        }
      } else if (e.key === "Enter") {
        e.preventDefault()
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
  }, [open, pageCustomers, selectedIndex, totalRows, isConsumerFinalSelected, onSelect, onClose, page, totalPages])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

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
          {pageCustomers.length > 0 ? (
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
                  setPage((p) => p - 1)
                  setSelectedIndex(0)
                }}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ""}`}
                  onClick={() => {
                    setPage(p)
                    setSelectedIndex(0)
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                className={styles.pageBtn}
                disabled={page === totalPages}
                onClick={() => {
                  setPage((p) => p + 1)
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


