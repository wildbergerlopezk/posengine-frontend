"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useLogin } from "../hooks/useLogin"
import styles from "./auth.module.css"

export function LoginForm() {
  const { login, isLoading, error } = useLogin()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isRemember, setIsRemember] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login({ email, password, isRemember })
  }

  return (
    <div className={styles.supabaseFormContainer}>
      <div className={styles.supabaseHeader}>
        <h1 className={styles.supabaseTitle}>Bienvenido de vuelta</h1>
        <p className={styles.supabaseSubtitle}>Inicia sesión con tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.errorMessage}>{error}</div>}

        <div className={styles.formGroup}>
          <label htmlFor="email" className={styles.label}>Email</label>
          <input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <div className={styles.labelRow}>
            <label htmlFor="password" className={styles.label}>Contraseña</label>
            <Link href="/forgot-password" className={styles.forgotLink}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className={styles.inputWrapper}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
            <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className={styles.rememberRow}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isRemember}
              onChange={(e) => setIsRemember(e.target.checked)}
              className={styles.checkbox}
            />
            Recordarme
          </label>
        </div>

        <button type="submit" className={styles.submitButton} disabled={isLoading}>
          {isLoading ? (
            <><Loader2 size={16} className={styles.spinner} />Ingresando...</>
          ) : (
            "Ingresar"
          )}
        </button>

        <p className={styles.registerLink}>
          ¿No tienes una cuenta? <Link href="/register">Regístrate</Link>
        </p>
      </form>
    </div>
  )
}