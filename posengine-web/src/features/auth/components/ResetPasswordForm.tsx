"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { useResetPassword } from "../hooks/useResetPassword"
import styles from "./auth.module.css"
import pageStyles from "../pages/ForgotPassword.module.css"

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

export function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const { resetPassword, isLoading, error, isSuccess } = useResetPassword()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const strength = useMemo(() => getPasswordStrength(password), [password])
  const passwordsMatch = password.length >= 6 && password === confirmPassword
  const isValid = passwordsMatch && token

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isLoading) return
    await resetPassword(token, password)
  }

  if (!token) {
    return (
      <div className={styles.form}>
        <div className={styles.errorMessage}>
          <AlertCircle size={16} />
          El enlace de recuperación es inválido o no contiene un token de acceso.
        </div>
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link href="/login" className={pageStyles.backLink}>
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className={styles.form}>
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ display: "inline-flex", color: "var(--color-primary)", marginBottom: "1rem" }}>
            <CheckCircle2 size={48} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--color-foreground)" }}>
            Contraseña restablecida
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--color-muted-foreground)", lineHeight: 1.5, marginBottom: "2rem" }}>
            Tu contraseña ha sido actualizada con éxito. Ya puedes iniciar sesión con tus nuevas credenciales.
          </p>
        </div>

        <Link href="/login" className={styles.submitButton}>
          Iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <p style={{ fontSize: "0.875rem", color: "var(--color-muted-foreground)", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
        Ingresa tu nueva contraseña para tu cuenta de PosEngine.
      </p>

      {error && (
        <div className={styles.errorMessage}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className={styles.formGroup}>
        <label htmlFor="password" className={styles.label}>Nueva contraseña</label>
        <div className={styles.inputWrapper}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
            disabled={isLoading}
            autoFocus
          />
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
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
          required
          disabled={isLoading}
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

      <button type="submit" className={styles.submitButton} disabled={isLoading || !isValid}>
        {isLoading ? (
          <>
            <Loader2 size={16} className={styles.spinner} />
            Restableciendo...
          </>
        ) : (
          "Cambiar contraseña"
        )}
      </button>
    </form>
  )
}
