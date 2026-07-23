"use client"
import type React from "react"
import { useState, useMemo } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, ArrowLeft, ArrowRight } from "lucide-react"
import styles from "./auth.module.css"
import { useRegister } from "../hooks/useRegister"

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const levels = [
    { score: 1, label: "Muy débil", color: "var(--strength-weak)" },
    { score: 2, label: "Débil", color: "var(--strength-fair)" },
    { score: 3, label: "Buena", color: "var(--strength-good)" },
    { score: 4, label: "Fuerte", color: "var(--strength-strong)" },
  ]
  return levels[score - 1] || { score: 0, label: "", color: "" }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function RegisterForm() {
  const { register, isLoading, error } = useRegister()
  const [step, setStep] = useState(1)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [tenantName, setTenantName] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const step1Valid = name.trim().length > 1 && isValidEmail(email)
  const strength = useMemo(() => getPasswordStrength(password), [password])
  const passwordsMatch = password.length >= 6 && password === confirmPassword
  const step2Valid = passwordsMatch
  const step3Valid = tenantName.trim().length > 1

  const canGoNext = step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100
  const progressLabel = step === 1 ? "Paso 1 de 3 — Tus datos" : step === 2 ? "Paso 2 de 3 — Seguridad" : "Paso 3 de 3 — Tu negocio"

  const handleNext = () => {
    if (step < 3 && canGoNext) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step !== 3 || !step3Valid) return
    await register({ name, email, password, tenantName })
  }

  return (
    <div className={styles.supabaseFormContainer}>
      <div className={styles.supabaseHeader}>
        <h1 className={styles.supabaseTitle}>Crear cuenta</h1>
        <p className={styles.supabaseSubtitle}>Regístrate y configura tu negocio en pocos pasos</p>
      </div>

      <div className={styles.progressWrap}>
        <div className={styles.progressMeta}>
          <span className={styles.progressLabel}>{progressLabel}</span>
          <span className={styles.progressPct}>{progress}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className={styles.errorMessage}>
            <span className={styles.errorDot} />
            {error}
          </div>
        )}

        {/* Paso 1: Datos personales */}
        {step === 1 && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="name" className={styles.label}>Nombre completo</label>
              <input
                id="name"
                type="text"
                placeholder="Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
                autoFocus
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${styles.input} ${email && !isValidEmail(email) ? styles.inputError : ""}`}
              />
              {email && !isValidEmail(email) && (
                <span className={`${styles.fieldHint} ${styles.fieldHintError}`}>
                  Ingresá un email válido
                </span>
              )}
            </div>
          </div>
        )}

        {/* Paso 2: Contraseña */}
        {step === 2 && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>Contraseña</label>
              <div className={styles.inputWrapper}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && (
                <div className={styles.strengthWrap}>
                  <div className={styles.strengthBar}>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={styles.strengthSeg}
                        style={{ background: i <= strength.score ? strength.color : undefined }}
                      />
                    ))}
                  </div>
                  <span className={styles.strengthLabel} style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>Confirmar contraseña</label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${styles.input} ${
                  confirmPassword
                    ? passwordsMatch
                      ? styles.inputSuccess
                      : styles.inputError
                    : ""
                }`}
              />
              {confirmPassword && (
                <div className={`${styles.matchBadge} ${passwordsMatch ? styles.matchOk : styles.matchNo}`}>
                  {passwordsMatch ? (
                    <><CheckCircle2 size={13} /> Contraseñas coinciden</>
                  ) : (
                    <><XCircle size={13} /> No coinciden</>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paso 3: Negocio */}
        {step === 3 && (
          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="tenantName" className={styles.label}>Nombre del negocio</label>
              <input
                id="tenantName"
                type="text"
                placeholder="Mi Tienda"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className={styles.input}
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Botones de navegación */}
        <div className={styles.stepActions}>
          {step > 1 && (
            <button type="button" className={styles.backButton} onClick={handleBack}>
              <ArrowLeft size={16} />
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleNext}
              disabled={!canGoNext}
            >
              Siguiente <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading || !step3Valid}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  Creando cuenta...
                </>
              ) : (
                "Crear cuenta"
              )}
            </button>
          )}
        </div>

        <p className={styles.registerLink} style={{ marginTop: "1rem" }}>
          ¿Ya tienes una cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </form>
    </div>
  )
}