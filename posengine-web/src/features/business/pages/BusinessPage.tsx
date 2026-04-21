"use client"

import type React from "react"
import { useState } from "react"
import { Header } from "@/src/shared/components/Header"
import { Building2, Save, Loader2 } from "lucide-react"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import styles from "./BusinessPage.module.css"

const currencies = [
  { code: "ARS", name: "Peso Argentino" },
  { code: "USD", name: "Dólar Estadounidense" },
  { code: "EUR", name: "Euro" },
  { code: "MXN", name: "Peso Mexicano" },
  { code: "COP", name: "Peso Colombiano" },
]

export function BusinessPage() {
  // const { tenant, setTenant } = useAuthStore() // Tenant is not in AuthState
  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    await new Promise((resolve) => setTimeout(resolve, 1000))

    /*
    if (tenant) {
      setTenant({
        ...tenant,
        name: formData.name,
      })
    }
    */

    setIsLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className={styles.page}>
      <Header title="Mi Negocio" />

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <Building2 size={24} />
            </div>
            <div className={styles.cardTitleSection}>
              <h2 className={styles.cardTitle}>Información del negocio</h2>
              <p className={styles.cardDescription}>Configura los datos de tu negocio</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre del negocio *</label>
              <input
                className={styles.input}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre de tu negocio"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Dirección</label>
              <textarea
                className={styles.textarea}
                placeholder="Dirección completa"
                rows={2}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Teléfono</label>
                <input
                  className={styles.input}
                  type="tel"
                  placeholder="+54 11 1234-5678"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="contacto@negocio.com"
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Moneda</label>
              <select
                className={styles.select}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.submitButton} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar cambios
                  </>
                )}
              </button>
              {saved && <span className={styles.savedMessage}>Cambios guardados correctamente</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
