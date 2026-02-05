"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2, ArrowRight, Check } from "lucide-react"
import { useAuthStore } from "../store/auth.store"
import { createTenantApi } from "../api/auth.api"
import styles from "./OnboardingPage.module.css"

const steps = [
  { id: 1, title: "Información básica" },
  { id: 2, title: "Detalles del negocio" },
  { id: 3, title: "Configuración" },
]

const currencies = [
  { code: "ARS", name: "Peso Argentino" },
  { code: "USD", name: "Dólar Estadounidense" },
  { code: "EUR", name: "Euro" },
  { code: "MXN", name: "Peso Mexicano" },
  { code: "COP", name: "Peso Colombiano" },
]

const businessTypes = ["Tienda minorista", "Supermercado", "Restaurante", "Farmacia", "Ferretería", "Librería", "Otro"]

export function OnboardingPage() {
  const router = useRouter()
  const { setTenant, user } = useAuthStore()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const [businessName, setBusinessName] = useState("")
  const [businessType, setBusinessType] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [currency, setCurrency] = useState("ARS")

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!user) return

    setIsLoading(true)

    const tenant = await createTenantApi({ businessName, businessType, address, phone, currency }, user)

    setTenant(tenant)
    router.push("/dashboard")
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return businessName.length >= 3
      case 2:
        return businessType !== ""
      case 3:
        return true
      default:
        return false
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
          <p className={styles.cardDescription}>Completa la información de tu negocio para comenzar</p>
        </div>

        {/* Progress Steps */}
        <div className={styles.steps}>
          {steps.map((step, index) => (
            <div key={step.id} className={styles.step}>
              <div
                className={`${styles.stepNumber} ${currentStep >= step.id ? styles.stepNumberActive : styles.stepNumberInactive}`}
              >
                {currentStep > step.id ? <Check size={16} /> : step.id}
              </div>
              <span
                className={`${styles.stepLabel} ${currentStep >= step.id ? styles.stepLabelActive : styles.stepLabelInactive}`}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`${styles.stepConnector} ${currentStep > step.id ? styles.stepConnectorActive : styles.stepConnectorInactive}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className={styles.cardContent}>
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className={styles.formGroup}>
              <label className={styles.label}>Nombre del negocio *</label>
              <input
                className={styles.input}
                placeholder="Ej: Mi Tienda"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <p className={styles.hint}>Este nombre se mostrará en tus tickets y reportes</p>
            </div>
          )}

          {/* Step 2: Business Details */}
          {currentStep === 2 && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Tipo de negocio *</label>
                <select
                  className={styles.select}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                >
                  <option value="">Selecciona el tipo de negocio</option>
                  {businessTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Dirección (opcional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Dirección de tu negocio"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Teléfono (opcional)</label>
                <input
                  className={styles.input}
                  type="tel"
                  placeholder="+54 11 1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Step 3: Configuration */}
          {currentStep === 3 && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Moneda principal *</label>
                <select className={styles.select} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
                <p className={styles.hint}>Esta moneda se usará para todos los precios y reportes</p>
              </div>

              <div className={styles.summaryBox}>
                <h4 className={styles.summaryTitle}>Resumen</h4>
                <div className={styles.summaryList}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Negocio:</span>
                    <span className={styles.summaryValue}>{businessName}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Tipo:</span>
                    <span className={styles.summaryValue}>{businessType}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Moneda:</span>
                    <span className={styles.summaryValue}>{currency}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.cardFooter}>
          <button className={styles.backButton} onClick={handleBack} disabled={currentStep === 1}>
            Atrás
          </button>
          {currentStep < 3 ? (
            <button className={styles.nextButton} onClick={handleNext} disabled={!canProceed()}>
              Siguiente
              <ArrowRight size={16} />
            </button>
          ) : (
            <button className={styles.nextButton} onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  Creando...
                </>
              ) : (
                "Crear negocio"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
