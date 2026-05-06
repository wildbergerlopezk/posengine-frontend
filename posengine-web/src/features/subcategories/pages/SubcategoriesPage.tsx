"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Header } from "@/src/shared/components/Header"
import { Plus, FolderTree, Pencil, Trash2, Loader2, AlertCircle, Folder, Filter } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import type { Category, Subcategory } from "@/src/shared/types"
import styles from "./SubcategoriesPage.module.css"

const API_BASE = API_BASE_URL

export function SubcategoriesPage() {
    const { accessToken } = useAuthStore()
    const searchParams = useSearchParams()
    const urlCategoryId = searchParams.get("categoryId")

    const [subcategories, setSubcategories] = useState<Subcategory[]>([])
    const [parentCategories, setParentCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [submitError, setSubmitError] = useState<string | null>(null)

    const [formData, setFormData] = useState({ name: "", categoryId: "" })
    const [filterCategoryId, setFilterCategoryId] = useState<string>(urlCategoryId || "")

    useEffect(() => {
        if (urlCategoryId) {
            setFilterCategoryId(urlCategoryId)
        }
    }, [urlCategoryId])

    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
    }

    // ── Fetch all subcategories & categories ────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [subsRes, catsRes] = await Promise.all([
                fetch(`${API_BASE}/subcategories?limit=100`, { headers: authHeaders }),
                fetch(`${API_BASE}/categories?limit=100`, { headers: authHeaders })
            ])

            if (!subsRes.ok || !catsRes.ok) throw new Error("Error al cargar datos")

            const subsData = await subsRes.json()
            const catsData = await catsRes.json()

            setSubcategories(subsData.items ?? subsData)
            setParentCategories(catsData.items ?? catsData)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [accessToken])

    useEffect(() => { fetchData() }, [fetchData])

    // ── Helpers ──────────────────────────────────────────────────────────────
    const resetForm = () => {
        setFormData({ name: "", categoryId: "" })
        setEditingSubcategory(null)
        setDeleteError(null)
        setSubmitError(null)
    }

    const handleEdit = (subcat: Subcategory) => {
        setEditingSubcategory(subcat)
        setFormData({ name: subcat.name, categoryId: subcat.categoryId })
        setIsDialogOpen(true)
    }

    // ── Delete ───────────────────────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        setDeleteError(null)
        try {
            const res = await fetch(`${API_BASE}/subcategories/${id}`, {
                method: "DELETE",
                headers: authHeaders,
            })
            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.message ?? "Error al eliminar subcategoría")
            }
            setSubcategories((prev) => prev.filter((s) => s.id !== id))
        } catch (err: any) {
            setDeleteError(err.message)
        }
    }

    // ── Create / Update ──────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setSubmitError(null)
        try {
            const url = editingSubcategory
                ? `${API_BASE}/subcategories/${editingSubcategory.id}`
                : `${API_BASE}/subcategories`

            const res = await fetch(url, {
                method: editingSubcategory ? "PATCH" : "POST",
                headers: authHeaders,
                body: JSON.stringify(formData),
            })

            if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.message ?? "Error al procesar")
            }

            const result = await res.json()
            const parent = parentCategories.find((c) => c.id === result.categoryId)
            const subcatWithCategory = { ...result, category: parent }

            if (editingSubcategory) {
                setSubcategories((prev) => prev.map((s) => (s.id === result.id ? subcatWithCategory : s)))
            } else {
                setSubcategories((prev) => [...prev, subcatWithCategory])
            }
            setIsDialogOpen(false)
            resetForm()
        } catch (err: any) {
            setSubmitError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const filteredSubcategories = filterCategoryId
        ? subcategories.filter(s => s.categoryId === filterCategoryId)
        : subcategories

    return (
        <div className={styles.page}>
            <Header title="Subcategorías" />

            <div className={styles.container}>
                <div className={styles.actionsBar}>
                    <p className={styles.description}>Gestiona las subcategorías de tus productos</p>
                    <div className={styles.actionsGroup}>
                        <div className={styles.filterGroup}>
                            <Filter size={16} className={styles.filterIcon} />
                            <select
                                className={styles.filterSelect}
                                value={filterCategoryId}
                                onChange={(e) => setFilterCategoryId(e.target.value)}
                            >
                                <option value="">Todas las categorías</option>
                                {parentCategories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <button className={styles.newButton} onClick={() => { resetForm(); setIsDialogOpen(true) }}>
                            <Plus size={16} />
                            Nueva subcategoría
                        </button>
                    </div>
                </div>

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
                        <p>Cargando subcategorías…</p>
                    </div>
                ) : error ? (
                    <div className={styles.emptyState}>
                        <AlertCircle size={48} className={styles.emptyStateIcon} />
                        <p className={styles.emptyStateTitle}>{error}</p>
                        <button className={styles.newButton} onClick={fetchData}>Reintentar</button>
                    </div>
                ) : subcategories.length > 0 ? (
                    <div className={styles.categoriesGrid}>
                        {filteredSubcategories.map((subcat) => (
                            <div key={subcat.id} className={styles.categoryCard}>
                                <div className={styles.categoryHeader} style={{ borderBottom: 'none' }}>
                                    <div className={styles.categoryTitle}>
                                        <FolderTree size={20} color="#64748b" />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ cursor: 'default' }}>{subcat.name}</span>
                                            <Link
                                                href="/dashboard/categories"
                                                className={styles.parentBadge}
                                                title="Ir a categoría"
                                            >
                                                <Folder size={12} /> {subcat.category?.name ?? 'Categoría base'}
                                            </Link>
                                        </div>
                                    </div>

                                    <div className={styles.categoryActions}>
                                        <button className={styles.iconButton} onClick={() => handleEdit(subcat)} title="Editar">
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            className={`${styles.iconButton} ${styles.iconButtonDestructive}`}
                                            onClick={() => handleDelete(subcat.id)}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <FolderTree size={48} className={styles.emptyStateIcon} />
                        <p className={styles.emptyStateTitle}>No hay subcategorías</p>
                        <p>Crea tu primera subcategoría para una mejor organización</p>
                    </div>
                )}
            </div>

            {isDialogOpen && (
                <div className={styles.modalOverlay} onClick={() => { setIsDialogOpen(false); resetForm() }}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>{editingSubcategory ? "Editar subcategoría" : "Nueva subcategoría"}</h2>
                            <p className={styles.modalDescription}>
                                {editingSubcategory ? "Modifica los datos de la subcategoría" : "Ingresa los datos de la nueva subcategoría"}
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
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Nombre (ej. Motocicletas)"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Categoría Padre *</label>
                                    <select
                                        className={styles.select}
                                        value={formData.categoryId}
                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                        required
                                    >
                                        <option value="">Selecciona una categoría</option>
                                        {parentCategories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button type="button" className={styles.cancelButton} onClick={() => { setIsDialogOpen(false); resetForm() }}>
                                    Cancelar
                                </button>
                                <button type="submit" className={styles.submitButton} disabled={submitting}>
                                    {submitting && <Loader2 size={14} className={styles.spinner} />}
                                    {editingSubcategory ? "Guardar cambios" : "Crear subcategoría"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
