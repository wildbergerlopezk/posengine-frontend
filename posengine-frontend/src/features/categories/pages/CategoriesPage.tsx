"use client"

import type React from "react"
import { useState } from "react"
import { Header } from "@/src/shared/components/Header"
import { Plus, FolderTree, Pencil, Trash2, ChevronRight, Folder, FolderOpen } from "lucide-react"
import { mockCategories } from "@/src/shared/api/mock-data"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import type { Category } from "@/src/shared/types"
import styles from "./CategoriesPage.module.css"

export function CategoriesPage() {
  const { tenant } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>(mockCategories)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const [formData, setFormData] = useState({
    name: "",
    parentId: "none",
  })

  const parentCategories = categories.filter((c) => !c.parentId)

  const getSubcategories = (parentId: string) => {
    return categories.filter((c) => c.parentId === parentId)
  }

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const resetForm = () => {
    setFormData({ name: "", parentId: "none" })
    setEditingCategory(null)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      parentId: category.parentId || "none",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (categoryId: string) => {
    setCategories(categories.filter((c) => c.id !== categoryId && c.parentId !== categoryId))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const categoryData: Category = {
      id: editingCategory?.id || `c-${Date.now()}`,
      tenantId: 1,
      name: formData.name,
      parentId: formData.parentId === "none" ? undefined : formData.parentId,
      createdAt: editingCategory?.createdAt || new Date(),
      updatedAt: new Date(),
    }

    if (editingCategory) {
      setCategories(categories.map((c) => (c.id === editingCategory.id ? categoryData : c)))
    } else {
      setCategories([...categories, categoryData])
    }

    setIsDialogOpen(false)
    resetForm()
  }

  return (
    <div className={styles.page}>
      <Header title="Categorías" />

      <div className={styles.container}>
        <div className={styles.actionsBar}>
          <p className={styles.description}>Organiza tus productos en categorías y subcategorías</p>
          <button className={styles.newButton} onClick={() => setIsDialogOpen(true)}>
            <Plus size={16} />
            Nueva categoría
          </button>
        </div>

        {parentCategories.length > 0 ? (
          <div className={styles.categoriesGrid}>
            {parentCategories.map((category) => {
              const subcats = getSubcategories(category.id)
              const isExpanded = expandedCategories.has(category.id)

              return (
                <div key={category.id} className={styles.categoryCard}>
                  <div className={styles.categoryHeader}>
                    <button className={styles.categoryTitle} onClick={() => toggleExpanded(category.id)}>
                      {subcats.length > 0 && (
                        <ChevronRight
                          size={16}
                          className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ""}`}
                        />
                      )}
                      {isExpanded ? <FolderOpen size={20} color="#2563eb" /> : <Folder size={20} color="#2563eb" />}
                      {category.name}
                    </button>
                    <div className={styles.categoryActions}>
                      <button className={styles.iconButton} onClick={() => handleEdit(category)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        className={`${styles.iconButton} ${styles.iconButtonDestructive}`}
                        onClick={() => handleDelete(category.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.categoryContent}>
                    {isExpanded && subcats.length > 0 ? (
                      <div className={styles.subcategoryList}>
                        {subcats.map((subcat) => (
                          <div key={subcat.id} className={styles.subcategoryItem}>
                            <span className={styles.subcategoryName}>
                              <FolderTree size={16} color="#64748b" />
                              {subcat.name}
                            </span>
                            <div className={styles.subcategoryActions}>
                              <button className={styles.smallIconButton} onClick={() => handleEdit(subcat)}>
                                <Pencil size={12} />
                              </button>
                              <button
                                className={`${styles.smallIconButton} ${styles.iconButtonDestructive}`}
                                onClick={() => handleDelete(subcat.id)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : subcats.length === 0 ? (
                      <p className={styles.noSubcategories}>Sin subcategorías</p>
                    ) : null}
                  </div>
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

      {/* Category Modal */}
      {isDialogOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsDialogOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingCategory ? "Editar categoría" : "Nueva categoría"}</h2>
              <p className={styles.modalDescription}>
                {editingCategory ? "Modifica los datos de la categoría" : "Crea una nueva categoría o subcategoría"}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.modalContent}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Nombre *</label>
                  <input
                    className={styles.input}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre de la categoría"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Categoría padre (opcional)</label>
                  <select
                    className={styles.select}
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  >
                    <option value="none">Ninguna (categoría principal)</option>
                    {parentCategories
                      .filter((c) => c.id !== editingCategory?.id)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                  <p className={styles.hint}>Selecciona una categoría padre para crear una subcategoría</p>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setIsDialogOpen(false)
                    resetForm()
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.submitButton}>
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
