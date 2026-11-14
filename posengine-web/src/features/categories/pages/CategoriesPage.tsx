"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { Header } from "@/src/shared/components/Header"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { API_BASE_URL } from "@/src/shared/config/api"
import { fetchAllPaginated } from "@/src/shared/api/fetchAllPaginated"
import type { Category, Subcategory } from "@/src/shared/types"
import { SubcategoryFormModal } from "@/src/features/subcategories/components/SubcategoryFormModal"
import { useDialogFocus } from "@/src/shared/hooks/useDialogFocus"
import styles from "./CategoriesPage.module.css"

type CategoryResult = {
  category: Category
  visibleSubcategories: Subcategory[]
  categoryMatches: boolean
  hasSubcategoryMatch: boolean
}

export function CategoriesPage() {
  const { accessToken } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false)
  const [subcategoryInitialCategoryId, setSubcategoryInitialCategoryId] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set())
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "" })
  const categoryDialogRef = useRef<HTMLDivElement>(null)

  useDialogFocus(categoryDialogRef, isCategoryDialogOpen)

  const fetchCategories = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAllPaginated<Category>(`${API_BASE_URL}/categories`, accessToken ?? "", signal)
      if (!signal.aborted) setCategories(result)
    } catch (caught) {
      if (!signal.aborted) setError(caught instanceof Error ? caught.message : "Error al cargar categorías")
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    const controller = new AbortController()
    void fetchCategories(controller.signal)
    return () => controller.abort()
  }, [fetchCategories, retryCount])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const categoryResults = useMemo<CategoryResult[]>(() => {
    return categories.flatMap((category) => {
      const subcategories = category.subcategories ?? []
      const categoryMatches = !debouncedSearch || category.name.toLocaleLowerCase().includes(debouncedSearch)
      const matchingSubcategories = debouncedSearch
        ? subcategories.filter((subcategory) => subcategory.name.toLocaleLowerCase().includes(debouncedSearch))
        : subcategories

      if (!categoryMatches && matchingSubcategories.length === 0) return []

      return [{
        category,
        visibleSubcategories: categoryMatches ? subcategories : matchingSubcategories,
        categoryMatches,
        hasSubcategoryMatch: !categoryMatches && matchingSubcategories.length > 0,
      }]
    })
  }, [categories, debouncedSearch])

  const toggleExpanded = (id: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const resetCategoryForm = () => {
    setFormData({ name: "" })
    setEditingCategory(null)
    setSubmitError(null)
  }

  const openCategoryEditor = (category: Category) => {
    setEditingCategory(category)
    setFormData({ name: category.name })
    setSubmitError(null)
    setIsCategoryDialogOpen(true)
  }

  const closeCategoryDialog = () => {
    setIsCategoryDialogOpen(false)
    resetCategoryForm()
  }

  const openSubcategoryCreator = (categoryId: string) => {
    setEditingSubcategory(null)
    setSubcategoryInitialCategoryId(categoryId)
    setIsSubcategoryDialogOpen(true)
  }

  const openSubcategoryEditor = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory)
    setSubcategoryInitialCategoryId(subcategory.categoryId)
    setIsSubcategoryDialogOpen(true)
  }

  const closeSubcategoryDialog = () => {
    setIsSubcategoryDialogOpen(false)
    setEditingSubcategory(null)
    setSubcategoryInitialCategoryId("")
  }

  const handleCategoryDelete = async (categoryId: string) => {
    setDeleteError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message ?? "Error al eliminar categoría")
      }
      setCategories((current) => current.filter((category) => category.id !== categoryId))
      setExpandedCategories((current) => {
        const next = new Set(current)
        next.delete(categoryId)
        return next
      })
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Error al eliminar categoría")
    }
  }

  const handleSubcategoryDelete = async (subcategory: Subcategory) => {
    setDeleteError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/subcategories/${subcategory.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message ?? "Error al eliminar subcategoría")
      }
      setCategories((current) => current.map((category) => ({
        ...category,
        subcategories: (category.subcategories ?? []).filter((item) => item.id !== subcategory.id),
      })))
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Error al eliminar subcategoría")
    }
  }

  const handleSubcategorySaved = (subcategory: Subcategory) => {
    setCategories((current) => current.map((category) => {
      const existing = category.subcategories ?? []
      const withoutSaved = existing.filter((item) => item.id !== subcategory.id)
      const nextSubcategories = category.id === subcategory.categoryId
        ? [...withoutSaved, subcategory].sort((left, right) => left.name.localeCompare(right.name))
        : withoutSaved
      return { ...category, subcategories: nextSubcategories }
    }).sort((left, right) => left.name.localeCompare(right.name)))

    setExpandedCategories((current) => new Set(current).add(subcategory.categoryId))
    closeSubcategoryDialog()
  }

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch(
        editingCategory
          ? `${API_BASE_URL}/categories/${editingCategory.id}`
          : `${API_BASE_URL}/categories`,
        {
          method: editingCategory ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ name: formData.name }),
        },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message ?? (editingCategory ? "Error al actualizar" : "Error al crear"))
      }

      const saved = await response.json() as Category
      setCategories((current) => {
        const withoutSaved = current.filter((category) => category.id !== saved.id)
        return [...withoutSaved, saved].sort((left, right) => left.name.localeCompare(right.name))
      })
      closeCategoryDialog()
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Error al procesar la categoría")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <Header title="Categorías" />

      <main className={styles.container}>
        <div className={styles.actionsBar}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar categoría o subcategoría…"
              aria-label="Buscar categorías y subcategorías"
            />
          </div>
          <button
            type="button"
            className={styles.newButton}
            onClick={() => { resetCategoryForm(); setIsCategoryDialogOpen(true) }}
          >
            <Plus size={16} />
            Nueva categoría
          </button>
        </div>

        {deleteError && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={16} />
            <span>{deleteError}</span>
            <button type="button" className={styles.errorDismiss} aria-label="Cerrar aviso" onClick={() => setDeleteError(null)}>×</button>
          </div>
        )}

        <section className={styles.categoryPanel} aria-label="Listado de categorías">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Categorías</h2>
              <span className={styles.panelCount}>
                {debouncedSearch
                  ? `${categoryResults.length} de ${categories.length} registradas`
                  : `${categories.length} registradas`}
              </span>
            </div>
            <FolderTree size={18} className={styles.panelIcon} />
          </div>

          {loading ? (
            <div className={styles.stateMessage} role="status">
              <Loader2 size={24} className={styles.spinner} />
              <span>Cargando categorías…</span>
            </div>
          ) : error ? (
            <div className={styles.stateMessage}>
              <AlertCircle size={24} className={styles.stateIconError} />
              <span role="alert">{error}</span>
              <button type="button" className={styles.retryButton} onClick={() => setRetryCount((current) => current + 1)}>Reintentar</button>
            </div>
          ) : categories.length === 0 ? (
            <div className={styles.stateMessage}>
              <FolderTree size={30} className={styles.stateIcon} />
              <strong>No hay categorías</strong>
              <span>Crea la primera para organizar tus productos.</span>
            </div>
          ) : categoryResults.length === 0 ? (
            <div className={styles.stateMessage}>
              <Search size={24} className={styles.stateIcon} />
              <strong>Sin resultados</strong>
              <span>No encontramos categorías o subcategorías con ese nombre.</span>
            </div>
          ) : (
            <div className={styles.categoryList}>
              {categoryResults.map(({ category, visibleSubcategories, categoryMatches, hasSubcategoryMatch }) => {
                const isExpanded = expandedCategories.has(category.id) || hasSubcategoryMatch
                const contentId = `category-content-${category.id}`

                return (
                  <article key={category.id} className={styles.categoryItem}>
                    <div className={styles.categoryRow}>
                      <button
                        type="button"
                        className={styles.categoryToggle}
                        aria-expanded={isExpanded}
                        aria-controls={contentId}
                        onClick={() => toggleExpanded(category.id)}
                      >
                        <ChevronDown className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ""}`} size={17} />
                        {isExpanded ? <FolderOpen size={19} className={styles.folderIcon} /> : <Folder size={19} className={styles.folderIcon} />}
                        <span className={styles.categoryName} title={category.name}>{category.name}</span>
                        <span className={styles.subcategoryCount}>
                          {category.subcategories?.length ?? 0} {(category.subcategories?.length ?? 0) === 1 ? "subcategoría" : "subcategorías"}
                        </span>
                      </button>

                      <div className={styles.categoryActions}>
                        <button type="button" className={styles.iconButton} aria-label={`Editar ${category.name}`} title="Editar" onClick={() => openCategoryEditor(category)}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" className={`${styles.iconButton} ${styles.iconButtonDestructive}`} aria-label={`Eliminar ${category.name}`} title="Eliminar" onClick={() => void handleCategoryDelete(category.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div id={contentId} className={styles.categoryContent}>
                        <div className={styles.subcategoryList}>
                          {visibleSubcategories.length > 0 ? visibleSubcategories.map((subcategory) => (
                            <div className={styles.subcategoryRow} key={subcategory.id}>
                              <Link
                                className={styles.subcategoryLink}
                                href={`/dashboard/subcategories?categoryId=${category.id}`}
                                title="Ver en Subcategorías"
                              >
                                <FolderTree size={15} />
                                <span>{subcategory.name}</span>
                              </Link>
                              <div className={styles.subcategoryActions}>
                                <button type="button" className={styles.smallIconButton} aria-label={`Editar ${subcategory.name}`} title="Editar subcategoría" onClick={() => openSubcategoryEditor(subcategory)}>
                                  <Pencil size={14} />
                                </button>
                                <button type="button" className={`${styles.smallIconButton} ${styles.iconButtonDestructive}`} aria-label={`Eliminar ${subcategory.name}`} title="Eliminar subcategoría" onClick={() => void handleSubcategoryDelete(subcategory)}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )) : (
                            <div className={styles.noSubcategories}>
                              <span>{categoryMatches ? "Esta categoría todavía no tiene subcategorías." : "No se encontraron subcategorías con ese nombre."}</span>
                            </div>
                          )}
                        </div>
                        <button type="button" className={styles.addSubcategoryButton} onClick={() => openSubcategoryCreator(category.id)}>
                          <Plus size={15} /> Nueva subcategoría
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {isCategoryDialogOpen && (
        <div className={styles.modalOverlay} onClick={submitting ? undefined : closeCategoryDialog}>
          <div
            ref={categoryDialogRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
            tabIndex={-1}
            data-pos-modal
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !submitting) closeCategoryDialog()
            }}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="category-modal-title" className={styles.modalTitle}>{editingCategory ? "Editar categoría" : "Nueva categoría"}</h2>
                <p className={styles.modalDescription}>{editingCategory ? "Modifica el nombre de la categoría" : "Ingresa el nombre de la nueva categoría"}</p>
              </div>
            </div>

            <form onSubmit={handleCategorySubmit}>
              <div className={styles.modalContent}>
                {submitError && (
                  <div className={styles.modalError} role="alert">
                    <AlertCircle size={16} /> <span>{submitError}</span>
                  </div>
                )}
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="category-name">Nombre *</label>
                  <input
                    id="category-name"
                    className={styles.input}
                    value={formData.name}
                    onChange={(event) => setFormData({ name: event.target.value })}
                    placeholder="Nombre de la categoría"
                    minLength={3}
                    maxLength={100}
                    required
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelButton} onClick={closeCategoryDialog} disabled={submitting}>Cancelar</button>
                <button type="submit" className={styles.submitButton} disabled={submitting}>
                  {submitting && <Loader2 size={14} className={styles.spinner} />}
                  {editingCategory ? "Guardar cambios" : "Crear categoría"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSubcategoryDialogOpen && accessToken && (
        <SubcategoryFormModal
          accessToken={accessToken}
          categories={categories}
          initialCategoryId={subcategoryInitialCategoryId}
          subcategory={editingSubcategory}
          onClose={closeSubcategoryDialog}
          onSaved={handleSubcategorySaved}
        />
      )}
    </div>
  )
}
