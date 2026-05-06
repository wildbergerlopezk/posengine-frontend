"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Header } from "@/src/shared/components/Header"
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Truck,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import type { Supplier } from "@/src/shared/types"
import styles from "./SuppliersPage.module.css"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"

const API_BASE = API_BASE_URL
const PAGE_SIZE = 20

function readApiError(body: unknown): string {
  if (!body || typeof body !== "object") return "Error en la solicitud"
  const b = body as { message?: unknown; error?: string }
  if (Array.isArray(b.message)) return b.message.map(String).join(" ")
  if (typeof b.message === "string") return b.message
  if (typeof b.error === "string") return b.error
  return "Error en la solicitud"
}

interface ConfirmState {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
}

export function SuppliersPage() {
  const { accessToken } = useAuthStore()
  const [items, setItems] = useState<Supplier[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  })

  const openConfirm = (title: string, description: string, onConfirm: () => void) =>
    setConfirm({ open: true, title, description, onConfirm })

  const closeConfirm = () => setConfirm((prev) => ({ ...prev, open: false }))

  const [formData, setFormData] = useState({
    name: "",
    RUC: "",
    address: "",
    phone: "",
  })

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const fetchSuppliers = useCallback(
    async (override?: { page?: number; search?: string }) => {
      const p = override?.page ?? page
      const s = override?.search ?? debouncedSearch
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(PAGE_SIZE),
        })
        if (s) params.set("search", s)
        const res = await fetch(`${API_BASE}/suppliers?${params}`, { headers: authHeaders })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(readApiError(body))
        }
        const data = await res.json()
        setItems(data.items ?? [])
        setTotal(typeof data.total === "number" ? data.total : 0)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error al cargar proveedores")
      } finally {
        setLoading(false)
      }
    },
    [accessToken, page, debouncedSearch],
  )

  useEffect(() => {
    void fetchSuppliers()
  }, [fetchSuppliers])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node))
        setOpenDropdown(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetForm = () => {
    setFormData({ name: "", RUC: "", address: "", phone: "" })
    setEditing(null)
    setSubmitError(null)
  }

  const handleEdit = (s: Supplier) => {
    setEditing(s)
    setFormData({
      name: s.name,
      RUC: s.RUC ?? "",
      address: s.address ?? "",
      phone: s.phone ?? "",
    })
    setIsDialogOpen(true)
    setOpenDropdown(null)
  }

  const buildPayload = () => {
    const name = formData.name.trim()
    const RUC = formData.RUC.trim()
    const address = formData.address.trim()
    const phone = formData.phone.replace(/\s+/g, "")
    return {
      name,
      RUC,
      ...(address ? { address } : {}),
      ...(phone ? { phone } : {}),
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    const payload = buildPayload()
    try {
      if (editing) {
        const res = await fetch(`${API_BASE}/suppliers/${editing.id}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(readApiError(body))
        }
        const updated: Supplier = await res.json()
        setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        const res = await fetch(`${API_BASE}/suppliers`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(readApiError(body))
        }
        setIsDialogOpen(false)
        resetForm()
        setSearchQuery("")
        setDebouncedSearch("")
        setPage(1)
        await fetchSuppliers({ page: 1, search: "" })
        setSubmitting(false)
        return
      }
      setIsDialogOpen(false)
      resetForm()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (s: Supplier) => {
    setOpenDropdown(null)
    openConfirm(
      "Eliminar proveedor",
      `¿Eliminar a "${s.name}"? Esta acción no se puede deshacer.`,
      async () => {
        closeConfirm()
        try {
          const res = await fetch(`${API_BASE}/suppliers/${s.id}`, {
            method: "DELETE",
            headers: authHeaders,
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(readApiError(body))
          }
          await fetchSuppliers()
        } catch (err: unknown) {
          openConfirm(
            "Error",
            err instanceof Error ? err.message : "Error al eliminar o al actualizar la lista",
            closeConfirm,
          )
        }
      },
    )
  }

  return (
    <div className={styles.page}>
      <Header title="Proveedores" />

      <div className={styles.container}>
        <div className={styles.toolbar}>
          <p className={styles.description}>
            Registra tus proveedores de productos con RUC, teléfono y dirección.
          </p>
          <div className={styles.toolbarActions}>
            <div className={tableStyles.searchWrapper}>
              <Search size={16} className={tableStyles.searchIcon} />
              <input
                placeholder="Buscar proveedores…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={tableStyles.searchInput}
              />
            </div>
            <button
              type="button"
              className={tableStyles.newButton}
              onClick={() => {
                resetForm()
                setIsDialogOpen(true)
              }}
            >
              <Plus size={16} /> Nuevo proveedor
            </button>
          </div>
        </div>

        <div className={tableStyles.tableCard}>
          {loading ? (
            <div className={tableStyles.loadingState}>
              <Loader2 size={32} className={tableStyles.spinner} />
              <p>Cargando proveedores…</p>
            </div>
          ) : error ? (
            <div className={tableStyles.emptyState}>
              <AlertCircle size={48} className={tableStyles.emptyStateIcon} />
              <p className={tableStyles.emptyStateTitle}>{error}</p>
              <button type="button" className={tableStyles.newButton} onClick={() => void fetchSuppliers()}>
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <div className={styles.tableToolbar}>
                <span className={styles.tableTitle}>
                  Proveedores <span className={styles.tableCount}>{total}</span>
                </span>
              </div>
              <table className={`${tableStyles.table} ${styles.suppliersTable}`}>
                <thead className={tableStyles.tableHeader}>
                  <tr>
                    <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>Proveedor</th>
                    <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>RUC</th>
                    <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>Teléfono</th>
                    <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>Dirección</th>
                    <th className={`${tableStyles.tableHeaderCell} ${tableStyles.tableHeaderCellRight} ${styles.headerCellOverride}`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className={tableStyles.emptyState}>
                          <Truck size={32} className={tableStyles.emptyStateIcon} />
                          <p>No hay proveedores{debouncedSearch ? " con ese criterio" : ""}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((s) => (
                      <tr key={s.id} className={tableStyles.tableRow}>
                        <td className={tableStyles.tableCell}>
                          <div className={styles.supplierCell}>
                            <span className={styles.supplierName}>{s.name}</span>
                          </div>
                        </td>
                        <td className={tableStyles.tableCell}>
                          {s.RUC ? <span className={styles.rucChip}>{s.RUC}</span> : <span className={styles.metaMuted}>—</span>}
                        </td>
                        <td className={tableStyles.tableCell}>
                          <span className={styles.metaMuted}>{s.phone ?? "—"}</span>
                        </td>
                        <td className={tableStyles.tableCell}>
                          <span className={styles.metaMuted}>{s.address ?? "—"}</span>
                        </td>
                        <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                          <div className={styles.actionButtons}>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => handleEdit(s)}
                              title="Editar"
                              aria-label="Editar proveedor"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnDestructive}`}
                              onClick={() => handleDelete(s)}
                              title="Eliminar"
                              aria-label="Eliminar proveedor"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {total > 0 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationInfo}>
                    Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
                  </span>
                  <div className={styles.paginationControls}>
                    <button
                      type="button"
                      className={styles.pageBtn}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      ← Anterior
                    </button>
                    <button
                      type="button"
                      className={styles.pageBtn}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isDialogOpen && (
        <div className={tableStyles.modalOverlay} onClick={() => { setIsDialogOpen(false); resetForm() }}>
          <div className={tableStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={tableStyles.modalHeader}>
              <h2 className={tableStyles.modalTitle}>{editing ? "Editar proveedor" : "Nuevo proveedor"}</h2>
              <p className={tableStyles.modalDescription}>
                {editing ? "Actualizá los datos del proveedor" : "Nombre y RUC son obligatorios para crear el registro"}
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={tableStyles.modalContent}>
                {submitError && (
                  <div className={tableStyles.errorBanner}>
                    <AlertCircle size={16} />
                    {submitError}
                  </div>
                )}
                <div className={tableStyles.formGroup}>
                  <label className={tableStyles.label} htmlFor="supplier-name">
                    Nombre *
                  </label>
                  <input
                    id="supplier-name"
                    className={tableStyles.input}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej. Distribuidora Central"
                    minLength={3}
                    maxLength={150}
                    required
                    autoFocus
                  />
                </div>
                <div className={tableStyles.formGroup}>
                  <label className={tableStyles.label} htmlFor="supplier-ruc">
                    RUC *
                  </label>
                  <input
                    id="supplier-ruc"
                    className={tableStyles.input}
                    value={formData.RUC}
                    onChange={(e) => setFormData({ ...formData, RUC: e.target.value })}
                    placeholder="12345678-9"
                    required
                  />
                  <span className={tableStyles.fieldHint}>Formato: 5 a 9 dígitos, guion y dígito verificador</span>
                </div>
                <div className={tableStyles.formGroup}>
                  <label className={tableStyles.label} htmlFor="supplier-phone">
                    Teléfono
                  </label>
                  <input
                    id="supplier-phone"
                    className={tableStyles.input}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+595971123456"
                  />
                  <span className={tableStyles.fieldHint}>Solo números, 7 a 15 dígitos; puede incluir + al inicio</span>
                </div>
                <div className={tableStyles.formGroup}>
                  <label className={tableStyles.label} htmlFor="supplier-address">
                    Dirección
                  </label>
                  <textarea
                    id="supplier-address"
                    className={styles.textarea}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Calle, ciudad…"
                    maxLength={250}
                    rows={3}
                  />
                </div>
              </div>
              <div className={tableStyles.modalFooter}>
                <button
                  type="button"
                  className={tableStyles.cancelButton}
                  onClick={() => { setIsDialogOpen(false); resetForm() }}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button type="submit" className={tableStyles.submitButton} disabled={submitting}>
                  {submitting && <Loader2 size={14} className={tableStyles.spinner} />}
                  {editing ? "Guardar cambios" : "Crear proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirm.open && (
        <div className={tableStyles.confirmOverlay} onClick={closeConfirm}>
          <div className={tableStyles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={tableStyles.confirmIcon}>
              <AlertTriangle size={22} />
            </div>
            <div className={tableStyles.confirmBody}>
              <h3 className={tableStyles.confirmTitle}>{confirm.title}</h3>
              <p className={tableStyles.confirmDescription}>{confirm.description}</p>
            </div>
            <div className={tableStyles.confirmFooter}>
              <button type="button" className={tableStyles.cancelButton} onClick={closeConfirm}>
                Cancelar
              </button>
              <button type="button" className={tableStyles.confirmDestructiveButton} onClick={confirm.onConfirm}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
