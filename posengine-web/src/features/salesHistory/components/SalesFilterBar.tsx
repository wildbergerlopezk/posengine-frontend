"use client"

import type React from "react"
import { Search, X } from "lucide-react"
import styles from "../pages/SalesHistoryPage.module.css"

type SaleStatus = "COMPLETED" | "CANCELLED"

interface SalesFilterBarProps {
  search: string
  onSearchChange: (val: string) => void
  statusFilter: SaleStatus | "ALL"
  onStatusChange: (val: SaleStatus | "ALL") => void
  dateFrom: string
  onDateFromChange: (val: string) => void
  dateTo: string
  onDateToChange: (val: string) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export function SalesFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClearFilters,
  hasActiveFilters,
}: SalesFilterBarProps) {
  return (
    <div className={styles.filtersBar}>
      <div className={styles.filtersRow}>
        <div className={styles.searchWrapper}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nombre de cliente o ID de venta…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
          {search && (
            <button type="button" className={styles.searchClear} onClick={() => onSearchChange("")}>
              <X size={13} />
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <button type="button" className={styles.clearFiltersBtn} onClick={onClearFilters}>
            <X size={13} /> Limpiar filtros
          </button>
        )}
      </div>

      <div className={styles.filtersRow}>
        <div className={styles.statusTabs}>
          {(["ALL", "COMPLETED", "CANCELLED"] as const).map(s => (
            <button
              key={s}
              type="button"
              className={`${styles.statusTab} ${statusFilter === s ? styles.statusTabActive : ""}`}
              onClick={() => onStatusChange(s)}
            >
              {s === "ALL" ? "Todos" : s === "COMPLETED" ? "Completada" : "Anulada"}
            </button>
          ))}
        </div>

        <div className={styles.dateRange}>
          <input
            type="date"
            className={styles.dateInput}
            value={dateFrom}
            onChange={e => onDateFromChange(e.target.value)}
            title="Desde"
          />
          <span className={styles.dateSeparator}>→</span>
          <input
            type="date"
            className={styles.dateInput}
            value={dateTo}
            onChange={e => onDateToChange(e.target.value)}
            title="Hasta"
          />
        </div>
      </div>
    </div>
  )
}
