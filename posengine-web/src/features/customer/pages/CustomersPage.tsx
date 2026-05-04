"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Header } from "@/src/shared/components/Header"
import {
  Search, Plus, Pencil, Trash2, X, Users,
  AlertCircle, Loader2, Check, ChevronLeft,
  ChevronRight, UserPlus, BadgeCheck, CreditCard,
} from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import tableStyles from "@/src/features/products/pages/ProductsPage.module.css"
import styles from "./CustomersPage.module.css"
import { ConfirmDialog } from "@/src/shared/components/ConfirmDialog"

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentType = "RUC" | "CI"

interface Customer {
  id: string
  name: string
  documentType: DocumentType
  documentNumber?: string
  phone?: string
  email?: string
  address?: string
  creditEnabled: boolean
  creditLimit: number
}

interface CustomerForm {
  name: string
  documentType: DocumentType
  documentNumber: string
  phone: string
  email: string
  address: string
  creditEnabled: boolean
  creditLimit: string
}

const EMPTY_FORM: CustomerForm = {
  name: "",
  documentType: "CI", documentNumber: "",
  phone: "", email: "",
  address: "",
  creditEnabled: false, creditLimit: "0",
}

function readApiError(body: unknown): string {
  if (!body || typeof body !== "object") return "Error en la solicitud"
  const b = body as { message?: unknown; error?: string }
  if (Array.isArray(b.message)) return b.message.map(String).join(" · ")
  if (typeof b.message === "string") return b.message
  if (typeof b.error === "string") return b.error
  return "Error en la solicitud"
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CustomersPage() {
  const { accessToken } = useAuthStore()
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  // ── List state ─────────────────────────────────────────────────────────────
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState("")
  const [creditFilter, setCreditFilter] = useState<"" | "true" | "false">("")
  const [page, setPage]             = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const LIMIT = 15

  // ── Form modal ─────────────────────────────────────────────────────────────
  const [showModal, setShowModal]     = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [form, setForm]               = useState<CustomerForm>(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const firstInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search.trim())   params.set("search", search.trim())
      if (creditFilter)    params.set("creditEnabled", creditFilter)

      const res = await fetch(`${API_BASE}/customers?${params}`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar clientes")
      const data = await res.json()
      setCustomers(data.items ?? [])
      setTotalItems(data.total ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [page, search, creditFilter, accessToken])

  useEffect(() => { void fetchCustomers() }, [fetchCustomers])
  useEffect(() => { setPage(1) }, [search, creditFilter])
  useEffect(() => {
    if (showModal) setTimeout(() => firstInputRef.current?.focus(), 80)
  }, [showModal])

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null); setForm(EMPTY_FORM)
    setFormError(null); setSaveSuccess(false); setShowModal(true)
  }

  const openEdit = (c: Customer) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      documentType: c.documentType,
      documentNumber: c.documentNumber ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      creditEnabled: c.creditEnabled,
      creditLimit: String(c.creditLimit),
    })
    setFormError(null); setSaveSuccess(false); setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditingId(null) }

  const setField = (field: keyof CustomerForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("El nombre es requerido")
      return
    }
    setSaving(true); setFormError(null)

    const payload = {
      name:           form.name.trim(),
      documentType:   form.documentType,
      documentNumber: form.documentNumber.trim() || undefined,
      phone:          form.phone.trim()   || undefined,
      email:          form.email.trim()   || undefined,
      address:        form.address.trim() || undefined,
      creditEnabled:  form.creditEnabled,
      creditLimit:    parseFloat(form.creditLimit)  || 0,
    }

    try {
      const url    = editingId ? `${API_BASE}/customers/${editingId}` : `${API_BASE}/customers`
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(payload) })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(readApiError(body))
      }
      setSaveSuccess(true)
      await fetchCustomers()
      setTimeout(closeModal, 900)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/customers/${deleteTarget.id}`, {
        method: "DELETE", headers: authHeaders,
      })
      if (!res.ok) throw new Error("Error al eliminar")
      await fetchCustomers()
      setDeleteTarget(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setDeleting(false)
    }
  }

  const totalPages   = Math.ceil(totalItems / LIMIT)
  const creditCount  = customers.filter(c => c.creditEnabled).length

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Header title="Clientes" />

      <div className={styles.container}>

        {error && (
          <div className={tableStyles.errorBanner}>
            <AlertCircle size={16} /> {error}
            <button type="button" className={styles.bannerClose} onClick={() => setError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        <div className={styles.statsRow}>
          <div className={styles.statChip}>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
              <Users size={20} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statChipLabel}>Total clientes</span>
              <span className={styles.statChipValue}>{totalItems}</span>
            </div>
          </div>
          <div className={styles.statChip}>
            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
              <CreditCard size={20} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statChipLabel}>Con crédito habilitado</span>
              <span className={styles.statChipValue}>{creditCount}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filtersBar}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Buscar por nombre, documento, teléfono…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch("")}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className={styles.statusTabs}>
            {(["", "true", "false"] as const).map(c => (
              <button
                key={c}
                type="button"
                className={`${styles.statusTab} ${creditFilter === c ? styles.statusTabActive : ""}`}
                onClick={() => setCreditFilter(c)}
              >
                {c === "" ? "Todo crédito" : c === "true" ? "Con crédito" : "Sin crédito"}
              </button>
            ))}
          </div>

          {(search || creditFilter !== "") && (
            <button className={styles.clearFiltersBtn} onClick={() => { setSearch(""); setCreditFilter("") }}>
              <X size={12} /> Limpiar
            </button>
          )}

          <button type="button" className={tableStyles.newButton} onClick={openCreate}>
            <UserPlus size={15} /> Nuevo cliente
          </button>
        </div>

        {/* Table */}
        <div className={tableStyles.tableCard}>
          <div className={styles.tableToolbar}>
            <span className={styles.tableTitle}>
              <Users size={16} /> Clientes
              <span className={styles.tableCount}>{totalItems}</span>
            </span>
          </div>

          <table className={`${tableStyles.table} ${styles.customersTable}`}>
            <thead className={tableStyles.tableHeader}>
              <tr>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>Nombre</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 180 }}>Documento</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`}>Contacto</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 130 }}>Crédito</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 220 }}>Dirección</th>
                <th className={`${tableStyles.tableHeaderCell} ${styles.headerCellOverride}`} style={{ width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className={tableStyles.emptyState}>
                      <Loader2 size={28} className={tableStyles.spinner} />
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className={tableStyles.emptyState}>
                      <Users size={36} className={tableStyles.emptyStateIcon} />
                      <p className={tableStyles.emptyStateTitle}>Sin clientes</p>
                      <p>Creá el primero con el botón "Nuevo cliente"</p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id} className={tableStyles.tableRow}>
                    <td className={tableStyles.tableCell}>
                      <div className={styles.customerName}>{c.name}</div>
                      {c.email && <div className={styles.customerSub}>{c.email}</div>}
                    </td>
                    <td className={tableStyles.tableCell}>
                      {c.documentNumber ? (
                        <div className={styles.docWrapper}>
                          <span className={`${styles.docBadge} ${c.documentType === "RUC" ? styles.docBadgeRUC : styles.docBadgeCI}`}>
                            {c.documentType}
                          </span>
                          <span className={styles.docNumber}>{c.documentNumber}</span>
                        </div>
                      ) : (
                        <span className={styles.emptyText}>—</span>
                      )}
                    </td>
                    <td className={tableStyles.tableCell}>
                      <div className={styles.contactWrapper}>
                        <span className={styles.phoneText}>{c.phone || "—"}</span>
                      </div>
                    </td>
                    <td className={tableStyles.tableCell}>
                      <div className={styles.creditWrapper}>
                        <div className={styles.creditStack}>
                          {c.creditEnabled ? (
                            <div className={`${styles.creditBadge} ${styles.creditOn}`}>
                              <Check size={12} /> Habilitado
                            </div>
                          ) : (
                            <div className={`${styles.creditBadge} ${styles.creditOff}`}>
                              <X size={12} /> Inhabilitado
                            </div>
                          )}
                          {c.creditEnabled && c.creditLimit > 0 && (
                            <span className={styles.creditLimitText}>
                              Límite: {formatCurrency(c.creditLimit)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={tableStyles.tableCell}>
                      <div className={styles.addressWrapper}>
                        {c.address || "—"}
                      </div>
                    </td>
                    <td className={`${tableStyles.tableCell} ${tableStyles.tableCellRight}`}>
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.iconBtn} onClick={() => openEdit(c)} title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => setDeleteTarget(c)} title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, totalItems)} de {totalItems}
              </span>
              <div className={styles.paginationControls}>
                <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ""}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                ))}
                <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL FORMULARIO
      ══════════════════════════════════════════════════ */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.formModal} onClick={e => e.stopPropagation()}>

            <div className={styles.formModalHeader}>
              <span className={styles.formModalTitle}>
                <UserPlus size={17} />
                {editingId ? "Editar cliente" : "Nuevo cliente"}
              </span>
              <button type="button" className={styles.modalCloseBtn} onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.formModalBody}>
              {formError && (
                <div className={tableStyles.errorBanner} style={{ marginBottom: 0 }}>
                  <AlertCircle size={15} /> {formError}
                </div>
              )}

              {/* Datos personales */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Datos del cliente</div>
                <div className={styles.formGrid}>
                  <div className={`${tableStyles.formGroup} ${styles.formGridFull}`}>
                    <label className={tableStyles.label} htmlFor="name">Nombre completo *</label>
                    <input ref={firstInputRef} id="name" className={tableStyles.input}
                      value={form.name} onChange={setField("name")} placeholder="Juan Pérez" />
                  </div>
                  <div className={tableStyles.formGroup}>
                    <label className={tableStyles.label}>Tipo de documento</label>
                    <div className={styles.docTypeToggle}>
                      <button type="button"
                        className={`${styles.docTypeBtn} ${form.documentType === "CI" ? styles.docTypeBtnActive : ""}`}
                        onClick={() => setForm(p => ({ ...p, documentType: "CI" }))}
                      >Cédula (CI)</button>
                      <button type="button"
                        className={`${styles.docTypeBtn} ${form.documentType === "RUC" ? styles.docTypeBtnActive : ""}`}
                        onClick={() => setForm(p => ({ ...p, documentType: "RUC" }))}
                      >RUC</button>
                    </div>
                  </div>
                  <div className={tableStyles.formGroup}>
                    <label className={tableStyles.label} htmlFor="documentNumber">
                      {form.documentType === "RUC" ? "Número de RUC" : "Número de Cédula"}
                    </label>
                    <input id="documentNumber" className={tableStyles.input}
                      value={form.documentNumber} onChange={setField("documentNumber")}
                      placeholder={form.documentType === "RUC" ? "80012345-1" : "5.123.456"} />
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Contacto</div>
                <div className={styles.formGrid}>
                  <div className={tableStyles.formGroup}>
                    <label className={tableStyles.label} htmlFor="phone">Teléfono / Celular</label>
                    <input id="phone" className={tableStyles.input} value={form.phone}
                      onChange={setField("phone")} placeholder="(0981)234567" />
                  </div>
                  <div className={tableStyles.formGroup}>
                    <label className={tableStyles.label} htmlFor="email">Email</label>
                    <input id="email" type="email" className={tableStyles.input}
                      value={form.email} onChange={setField("email")} placeholder="juan@email.com" />
                  </div>
                </div>
              </div>

              {/* Ubicación */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Ubicación</div>
                <div className={`${tableStyles.formGroup} ${styles.formGridFull}`}>
                  <label className={tableStyles.label} htmlFor="address">Dirección</label>
                  <input id="address" className={tableStyles.input} value={form.address}
                    onChange={setField("address")} placeholder="Av. Mariscal López 1234, Asunción" />
                </div>
              </div>

              {/* Crédito */}
              <div className={styles.formSection}>
                <div className={styles.formSectionTitle}>Crédito y descuentos</div>
                <div className={styles.creditToggleRow}>
                  <div className={styles.creditToggleLabel}>
                    <span className={styles.creditToggleLabelMain}>Habilitar crédito</span>
                    <span className={styles.creditToggleLabelSub}>Permite al cliente comprar a crédito</span>
                  </div>
                  <input type="checkbox" className={styles.toggle}
                    checked={form.creditEnabled}
                    onChange={e => setForm(p => ({ ...p, creditEnabled: e.target.checked }))} />
                </div>
                {form.creditEnabled && (
                  <div className={styles.formGrid}>
                    <div className={tableStyles.formGroup}>
                      <label className={tableStyles.label} htmlFor="creditLimit">Límite de crédito (Gs.)</label>
                      <input id="creditLimit" type="number" min="0" className={tableStyles.input}
                        value={form.creditLimit} onChange={setField("creditLimit")} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.formModalFooter}>
              <button type="button" className={tableStyles.cancelButton} onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className={tableStyles.submitButton}
                onClick={handleSave} disabled={saving || saveSuccess}>
                {saveSuccess
                  ? <><Check size={15} /> Guardado</>
                  : saving
                    ? <><Loader2 size={15} className={tableStyles.spinner} /> Guardando…</>
                    : <><Check size={15} /> {editingId ? "Guardar cambios" : "Crear cliente"}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`¿Eliminar a ${deleteTarget?.name}?`}
        message="El cliente será marcado como inactivo. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        type="danger"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}