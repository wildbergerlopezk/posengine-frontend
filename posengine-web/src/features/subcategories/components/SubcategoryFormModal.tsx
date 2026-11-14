"use client"

import type React from "react"
import { useRef, useState } from "react"
import { AlertCircle, Loader2, X } from "lucide-react"
import { API_BASE_URL } from "@/src/shared/config/api"
import { useDialogFocus } from "@/src/shared/hooks/useDialogFocus"
import type { Category, Subcategory } from "@/src/shared/types"
import styles from "./SubcategoryFormModal.module.css"

interface SubcategoryFormModalProps {
  accessToken: string
  categories: Category[]
  initialCategoryId?: string
  subcategory?: Subcategory | null
  onClose: () => void
  onSaved: (subcategory: Subcategory) => void
}

export function SubcategoryFormModal({
  accessToken,
  categories,
  initialCategoryId = "",
  subcategory = null,
  onClose,
  onSaved,
}: SubcategoryFormModalProps) {
  const [name, setName] = useState(subcategory?.name ?? "")
  const [categoryId, setCategoryId] = useState(subcategory?.categoryId ?? initialCategoryId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useDialogFocus(dialogRef, true, nameInputRef)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        subcategory
          ? `${API_BASE_URL}/subcategories/${subcategory.id}`
          : `${API_BASE_URL}/subcategories`,
        {
          method: subcategory ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ name, categoryId }),
        },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const message = Array.isArray(body.message)
          ? body.message.join(" ")
          : body.message
        throw new Error(message ?? "Error al procesar la subcategoría")
      }

      const saved = await response.json() as Subcategory
      onSaved({
        ...saved,
        category: categories.find((category) => category.id === saved.categoryId),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Error al procesar la subcategoría")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={submitting ? undefined : onClose}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subcategory-modal-title"
        tabIndex={-1}
        data-pos-modal
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !submitting) onClose()
        }}
      >
        <div className={styles.header}>
          <div>
            <h2 id="subcategory-modal-title" className={styles.title}>
              {subcategory ? "Editar subcategoría" : "Nueva subcategoría"}
            </h2>
            <p className={styles.description}>
              {subcategory ? "Modifica los datos de la subcategoría" : "Ingresa los datos de la nueva subcategoría"}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Cerrar formulario"
            onClick={onClose}
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.content}>
            {error && (
              <div className={styles.error} role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="subcategory-name" className={styles.label}>Nombre *</label>
              <input
                ref={nameInputRef}
                id="subcategory-name"
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre (ej. Motocicletas)"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="subcategory-category" className={styles.label}>Categoría padre *</label>
              <select
                id="subcategory-category"
                className={styles.select}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitButton} disabled={submitting}>
              {submitting && <Loader2 size={15} className={styles.spinner} />}
              {subcategory ? "Guardar cambios" : "Crear subcategoría"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
