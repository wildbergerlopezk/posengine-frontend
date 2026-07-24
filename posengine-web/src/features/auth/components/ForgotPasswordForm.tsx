"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { useForgotPassword } from "../hooks/useForgotPassword"
import styles from "./auth.module.css"
import pageStyles from "../pages/ForgotPassword.module.css"

export function ForgotPasswordForm() {
  const { forgotPassword, isLoading, error, isSuccess } = useForgotPassword()
  const [email, setEmail] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || isLoading) return
    await forgotPassword(email.trim())
  }

  if (isSuccess) {
    return (
      <div className={styles.form}>
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ display: "inline-flex", color: "var(--color-primary)", marginBottom: "1rem" }}>
            <CheckCircle2 size={48} />
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--color-foreground)" }}>
            Revisa tu correo
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--color-muted-foreground)", lineHeight: 1.5, marginBottom: "2rem" }}>
            Si existe una cuenta asociada a <strong>{email}</strong> recibirás un enlace para cambiar tu contraseña.
          </p>
        </div>

        <Link href="/login" className={styles.submitButton}>
          Volver al login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <p style={{ fontSize: "0.875rem", color: "var(--color-muted-foreground)", lineHeight: 1.5, margin: "0 0 1rem 0" }}>
        Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
      </p>

      {error && (
        <div className={styles.errorMessage}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className={styles.formGroup}>
        <label htmlFor="email" className={styles.label}>
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          placeholder="correo@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
          required
          disabled={isLoading}
        />
      </div>

      <button type="submit" className={styles.submitButton} disabled={isLoading || !email.trim()}>
        {isLoading ? (
          <>
            <Loader2 size={16} className={styles.spinner} />
            Enviando...
          </>
        ) : (
          "Enviar enlace"
        )}
      </button>

      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <Link href="/login" className={pageStyles.backLink}>
          <ArrowLeft size={16} />
          Volver al inicio de sesión
        </Link>
      </div>
    </form>
  )
}
