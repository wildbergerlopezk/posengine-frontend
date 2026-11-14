"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Folder,
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
import dataTableStyles from "@/src/shared/components/DataTable/DataTable.module.css"
import styles from "./SubcategoriesPage.module.css"

const PAGE_SIZE = 25

export function SubcategoriesPage() {
  const { accessToken } = useAuthStore()
  const searchParams = useSearchParams()
  const urlCategoryId = searchParams.get("categoryId") ?? ""

  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [parentCategories, setParentCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [filterCategoryId, setFilterCategoryId] = useState(urlCategoryId)
  const [page, setPage] = useState(1)
  const [retryCount, setRetryCount] = useState(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)

  const fetchData = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const [subcategoryItems, categoryItems] = await Promise.all([
        fetchAllPaginated<Subcategory>(`${API_BASE_URL}/subcategories`, accessToken ?? "", signal),
        fetchAllPaginated<Category>(`${API_BASE_URL}/categories`, accessToken ?? "", signal),
      ])
      if (signal.aborted) return
      setSubcategories(subcategoryItems)
      setParentCategories(categoryItems)
    } catch (caught) {
      if (!signal.aborted) setError(caught instanceof Error ? caught.message : "Error al cargar datos")
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    const controller = new AbortController()
    void fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData, retryCount])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLocaleLowerCase()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setFilterCategoryId(urlCategoryId)
    setPage(1)
  }, [urlCategoryId])

  const filteredSubcategories = useMemo(() => {
    return subcategories.filter((subcategory) => {
      const matchesCategory = !filterCategoryId || subcategory.categoryId === filterCategoryId
      const matchesSearch = !debouncedSearch || subcategory.name.toLocaleLowerCase().includes(debouncedSearch)
      return matchesCategory && matchesSearch
    })
  }, [subcategories, filterCategoryId, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filteredSubcategories.length / PAGE_SIZE))
  const visibleSubcategories = filteredSubcategories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const handleDelete = async (subcategory: Subcategory) => {
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
      setSubcategories((current) => current.filter((item) => item.id !== subcategory.id))
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Error al eliminar subcategoría")
    }
  }

  const handleSaved = (saved: Subcategory) => {
    setSubcategories((current) => {
      const withoutSaved = current.filter((item) => item.id !== saved.id)
      return [...withoutSaved, saved].sort((left, right) => left.name.localeCompare(right.name))
    })
    setIsDialogOpen(false)
    setEditingSubcategory(null)
    setDeleteError(null)
  }

  const openCreate = () => {
    setEditingSubcategory(null)
    setIsDialogOpen(true)
  }

  const openEdit = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory)
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingSubcategory(null)
  }

  return (
    <div className={styles.page}>
      <Header title="Subcategorías" />

      <main className={styles.container}>
        <div className={styles.actionsBar}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              placeholder="Buscar subcategoría…"
              aria-label="Buscar subcategorías"
            />
          </div>

          <div className={styles.actionsGroup}>
            <div className={styles.filterGroup}>
              <Folder size={16} className={styles.filterIcon} />
              <select
                className={styles.filterSelect}
                value={filterCategoryId}
                onChange={(event) => { setFilterCategoryId(event.target.value); setPage(1) }}
                aria-label="Filtrar por categoría"
              >
                <option value="">Todas las categorías</option>
                {parentCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <button type="button" className={styles.newButton} onClick={openCreate}>
              <Plus size={16} /> Nueva subcategoría
            </button>
          </div>
        </div>

        {deleteError && (
          <div className={styles.errorBanner} role="alert">
            <AlertCircle size={16} />
            <span>{deleteError}</span>
            <button type="button" className={styles.errorDismiss} aria-label="Cerrar aviso" onClick={() => setDeleteError(null)}>×</button>
          </div>
        )}

        <section className={dataTableStyles.adminTableCard} aria-label="Listado de subcategorías">
          <div className={styles.tableHeading}>
            <div className={styles.headingTitle}>
              <FolderTree size={17} />
              <h2>Subcategorías</h2>
            </div>
            <span className={styles.recordCount}>
              {debouncedSearch || filterCategoryId
                ? `${filteredSubcategories.length} de ${subcategories.length} registros`
                : `${subcategories.length} registros`}
            </span>
          </div>

          {loading ? (
            <div className={styles.stateMessage} role="status">
              <Loader2 size={24} className={styles.spinner} /> Cargando subcategorías…
            </div>
          ) : error ? (
            <div className={styles.stateMessage}>
              <AlertCircle size={24} className={styles.stateIconError} />
              <span role="alert">{error}</span>
              <button type="button" className={styles.retryButton} onClick={() => setRetryCount((current) => current + 1)}>Reintentar</button>
            </div>
          ) : (
            <div className={dataTableStyles.adminTableViewport}>
              <table className={`${dataTableStyles.adminTable} ${styles.table}`}>
                <thead>
                  <tr>
                    <th className={`${dataTableStyles.adminTableHead} ${styles.subcategoryColumn}`} scope="col">Subcategoría</th>
                    <th className={`${dataTableStyles.adminTableHead} ${styles.categoryColumn}`} scope="col">Categoría</th>
                    <th className={`${dataTableStyles.adminTableHead} ${styles.actionsColumn}`} scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSubcategories.length > 0 ? visibleSubcategories.map((subcategory) => (
                    <tr className={dataTableStyles.adminTableRow} key={subcategory.id}>
                      <td className={`${dataTableStyles.adminTableCell} ${styles.subcategoryCell}`}>
                        <div className={styles.subcategoryName} title={subcategory.name}>
                          <FolderTree size={16} />
                          <span>{subcategory.name}</span>
                        </div>
                      </td>
                      <td className={`${dataTableStyles.adminTableCell} ${styles.categoryCell}`}>
                        <Link className={styles.categoryLink} href={`/dashboard/categories`} title="Ver categorías">
                          <Folder size={15} />
                          <span>{subcategory.category?.name ?? parentCategories.find((item) => item.id === subcategory.categoryId)?.name ?? "Categoría"}</span>
                        </Link>
                      </td>
                      <td className={`${dataTableStyles.adminTableCell} ${styles.actionsCell}`}>
                        <div className={styles.rowActions}>
                          <button type="button" className={styles.iconButton} aria-label={`Editar ${subcategory.name}`} title="Editar" onClick={() => openEdit(subcategory)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" className={`${styles.iconButton} ${styles.iconButtonDestructive}`} aria-label={`Eliminar ${subcategory.name}`} title="Eliminar" onClick={() => void handleDelete(subcategory)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td className={dataTableStyles.adminTableEmpty} colSpan={3}>
                        {subcategories.length === 0
                          ? "No hay subcategorías. Crea la primera para organizar tus productos."
                          : "No hay subcategorías que coincidan con los filtros."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && filteredSubcategories.length > 0 && (
            <div className={dataTableStyles.adminTableFooter}>
              <span className={styles.paginationInfo}>
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredSubcategories.length)} de {filteredSubcategories.length}
              </span>
              <div className={styles.paginationControls}>
                <button type="button" className={styles.pageButton} aria-label="Página anterior" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                  <ChevronLeft size={16} />
                </button>
                <span>Página {page} de {totalPages}</span>
                <button type="button" className={styles.pageButton} aria-label="Página siguiente" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {isDialogOpen && accessToken && (
        <SubcategoryFormModal
          accessToken={accessToken}
          categories={parentCategories}
          initialCategoryId={filterCategoryId}
          subcategory={editingSubcategory}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
