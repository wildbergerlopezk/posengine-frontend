"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import styles from "./auth.module.css"
import { useRegister } from "../hooks/useRegister"

export function RegisterForm() {
  const { register, isLoading, error } = useRegister()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await register({ name, email, password, confirmPassword })
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h1 className={styles.cardTitle}>Crear cuenta</h1>
        <p className={styles.cardDescription}>Registra tu cuenta para comenzar a usar POSENGINE</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.cardContent}>
          <div className={styles.form}>
            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.formGroup}>
              <label htmlFor="name" className={styles.label}>
                Nombre completo
              </label>
              <input
                id="name"
                type="text"
                placeholder="Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
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
              <label htmlFor="password" className={styles.label}>
                Contraseña
              </label>
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

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                required
              />
            </div>
          </div>
        </div>

        <div className={styles.cardFooter}>
          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 size={16} className={styles.spinner} />
                Creando cuenta...
              </>
            ) : (
              "Crear cuenta"
            )}
          </button>

          <p className={styles.registerLink}>
            ¿Ya tienes una cuenta? <Link href="/login">Inicia sesión</Link>
          </p>
        </div>
      </form>
    </div>
  )
}
