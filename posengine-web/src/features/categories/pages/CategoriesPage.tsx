"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Header } from "@/src/shared/components/Header"
import { Plus, FolderTree, Pencil, Trash2, ChevronRight, Folder, FolderOpen, Loader2, AlertCircle } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import type { Category } from "@/src/shared/types"
import styles from "./CategoriesPage.module.css"

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL

export function CategoriesPage() {
  const { accessToken } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [formData, setFormData] = useState({ name: "" })

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }

  // ── Fetch all categories ─────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/categories?limit=100`, { headers: authHeaders })
      if (!res.ok) throw new Error("Error al cargar categorías")
      const data = await res.json()
      setCategories(data.items ?? data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const toggleExpanded = (id: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const resetForm = () => {
    setFormData({ name: "" })
    setEditingCategory(null)
    setDeleteError(null)
    setSubmitError(null)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({ name: category.name })
    setIsDialogOpen(true)
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (categoryId: string) => {
    setDeleteError(null)
    try {
      const res = await fetch(`${API_BASE}/categories/${categoryId}`, {
        method: "DELETE",
        headers: authHeaders,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? "Error al eliminar categoría")
      }
      setCategories((prev) => prev.filter((c) => c.id !== categoryId))
    } catch (err: any) {
      setDeleteError(err.message)
    }
  }

  // ── Create / Update ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingCategory) {
        const res = await fetch(`${API_BASE}/categories/${editingCategory.id}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ name: formData.name }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message ?? "Error al actualizar")
        }
        const updated = await res.json()
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } else {
        const res = await fetch(`${API_BASE}/categories`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ name: formData.name }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message ?? "Error al crear")
        }
        const created = await res.json()
        setCategories((prev) => [...prev, created])
      }
      setIsDialogOpen(false)
      resetForm()
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Header title="Categorías" />

      <div className={styles.container}>
        <div className={styles.actionsBar}>
          <p className={styles.description}>Organiza tus productos en categorías y subcategorías</p>
          <button className={styles.newButton} onClick={() => { resetForm(); setIsDialogOpen(true) }}>
            <Plus size={16} />
            Nueva categoría
          </button>
        </div>

        {/* Delete error banner */}
        {deleteError && (
          <div className={styles.errorBanner}>
            <AlertCircle size={16} />
            {deleteError}
            <button className={styles.errorDismiss} onClick={() => setDeleteError(null)}>✕</button>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 size={32} className={styles.spinner} />
            <p>Cargando categorías…</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <AlertCircle size={48} className={styles.emptyStateIcon} />
            <p className={styles.emptyStateTitle}>{error}</p>
            <button className={styles.newButton} onClick={fetchCategories}>Reintentar</button>
          </div>
        ) : categories.length > 0 ? (
          <div className={styles.categoriesGrid}>
            {categories.map((category) => {
              const subcats = category.subcategories ?? []
              const isExpanded = expandedCategories.has(category.id)

              return (
                <div key={category.id} className={styles.categoryCard}>
                  <div className={`${styles.categoryHeader} ${subcats.length === 0 ? styles.categoryHeaderNoBorder : ""}`}>
                    <button
                      className={styles.categoryTitle}
                      onClick={() => subcats.length > 0 && toggleExpanded(category.id)}
                      style={{ cursor: subcats.length > 0 ? "pointer" : "default" }}
                    >
                      {subcats.length > 0 && (
                        <ChevronRight
                          size={16}
                          className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ""}`}
                        />
                      )}
                      {isExpanded ? <FolderOpen size={20} color="#2563eb" /> : <Folder size={20} color="#2563eb" />}
                      <span>{category.name}</span>
                      {subcats.length === 0 && (
                        <span className={styles.noSubBadge}>sin subcategorías</span>
                      )}
                    </button>

                    <div className={styles.categoryActions}>
                      <button className={styles.iconButton} onClick={() => handleEdit(category)} title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button
                        className={`${styles.iconButton} ${styles.iconButtonDestructive}`}
                        onClick={() => handleDelete(category.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && subcats.length > 0 && (
                    <div className={styles.categoryContent}>
                      <div className={styles.subcategoryList}>
                        {subcats.map((subcat: any) => (
                          <div key={subcat.id} className={styles.subcategoryItem}>
                            <Link
                              href={`/dashboard/inventory/subcategories?categoryId=${category.id}`}
                              className={styles.subcategoryName}
                              title="Ver en subcategorías"
                            >
                              <FolderTree size={16} color="#64748b" />
                              {subcat.name}
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <FolderTree size={48} className={styles.emptyStateIcon} />
            <p className={styles.emptyStateTitle}>No hay categorías</p>
            <p>Crea tu primera categoría para organizar tus productos</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isDialogOpen && (
        <div className={styles.modalOverlay} onClick={() => { setIsDialogOpen(false); resetForm() }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingCategory ? "Editar categoría" : "Nueva categoría"}</h2>
              <p className={styles.modalDescription}>
                {editingCategory ? "Modifica el nombre de la categoría" : "Ingresa el nombre de la nueva categoría"}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.modalContent}>
                {submitError && (
                  <div className={styles.errorBanner} style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} />
                    {submitError}
                  </div>
                )}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nombre *</label>
                  <input
                    className={styles.input}
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    placeholder="Nombre de la categoría"
                    minLength={3}
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => { setIsDialogOpen(false); resetForm() }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton} disabled={submitting}>
                  {submitting ? <Loader2 size={14} className={styles.spinner} /> : null}
                  {editingCategory ? "Guardar cambios" : "Crear categoría"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}