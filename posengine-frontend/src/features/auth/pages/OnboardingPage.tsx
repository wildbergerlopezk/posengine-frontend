"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2 } from "lucide-react"
import { useAuthStore } from "../store/auth.store"
import { createTenantApi } from "../api/auth.api"
import type { RegisterTenantDto } from "@/src/shared/types/tenant/tenantType.dto"
import styles from "./OnboardingPage.module.css"

export function OnboardingPage() {
  const router = useRouter()
  const { setTenant, user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setError("No hay usuario autenticado")
      return
    }

    if (businessName.length < 3) {
      setError("El nombre debe tener al menos 3 caracteres")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const tenantDto: RegisterTenantDto = {
        name: businessName,
      }

      console.log("Creating tenant:", tenantDto)
      
      const tenant = await createTenantApi(tenantDto)
      
      console.log("Tenant created:", tenant)
      
      setTenant(tenant)
      router.push("/dashboard")
    } catch (err) {
      console.error("Error creating tenant:", err)
      setError(err instanceof Error ? err.message : "Error al crear el negocio")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.headerIcon}>
            <Building2 size={28} />
          </div>
          <h1 className={styles.cardTitle}>Configura tu negocio</h1>
          <p className={styles.cardDescription}>Ingresa el nombre de tu negocio para comenzar</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.cardContent}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Nombre del negocio *</label>
            <input
              className={styles.input}
              placeholder="Ej: Mi Tienda"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              disabled={isLoading}
            />
            <p className={styles.hint}>Este nombre identificará tu negocio en el sistema</p>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className={styles.nextButton} 
            disabled={isLoading || businessName.length < 3}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                Creando...
              </>
            ) : (
              "Crear negocio"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}