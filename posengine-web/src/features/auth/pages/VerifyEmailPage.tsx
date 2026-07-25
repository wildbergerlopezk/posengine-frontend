"use client"

import { useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, CheckCircle, AlertCircle, Loader2, ArrowLeft } from "lucide-react"
import { useAuthStore } from "../store/auth.store"
import { verifyEmailApi, resendVerificationEmailApi } from "../api"
import { AuthLayout, AuthCard } from "@/src/features/auth"
import styles from "./VerifyEmailPage.module.css"

export function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")
  
  const { user, accessToken, refreshToken, setAuth } = useAuthStore()
  
  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">(
    token ? "loading" : "idle"
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  // Prevenir que se ejecute dos veces en StrictMode
  const verificationStarted = useRef(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  useEffect(() => {
    if (!token || verificationStarted.current) return
    verificationStarted.current = true

    const verify = async () => {
      try {
        await verifyEmailApi(token)
        setStatus("success")
        
        // Obtener el estado actualizado (hidratado) en este momento
        const { user: freshUser, accessToken: freshToken, refreshToken: freshRefresh, setAuth: freshSetAuth } = useAuthStore.getState()
        if (freshUser && freshToken) {
          freshSetAuth({
            accessToken: freshToken,
            refreshToken: freshRefresh || "",
            user: {
              ...freshUser,
              emailVerified: true,
            },
          })
        }
      } catch (err) {
        setStatus("error")
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "No se pudo verificar el correo electrónico."
        )
      }
    }

    verify()
  }, [token])

  const handleResend = async () => {
    if (!accessToken) {
      setErrorMessage("Debes iniciar sesión para reenviar el correo de verificación.")
      return
    }

    setIsResending(true)
    setErrorMessage("")
    setResendSuccess(false)

    try {
      await resendVerificationEmailApi()
      setResendSuccess(true)
      setResendCooldown(60)
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Error al reenviar el correo de verificación."
      )
    } finally {
      setIsResending(false)
    }
  }

  const renderContent = () => {
    if (status === "loading") {
      return (
        <>
          <div className={`${styles.statusIconWrapper} ${styles.iconLoading}`}>
            <Loader2 className={`${styles.spinner}`} size={32} />
          </div>
          <h2 className={styles.title}>Verificando tu cuenta</h2>
          <p className={styles.description}>
            Por favor espera un momento mientras procesamos la verificación de tu dirección de correo electrónico.
          </p>
        </>
      )
    }

    if (status === "success") {
      return (
        <>
          <div className={`${styles.statusIconWrapper} ${styles.iconSuccess}`}>
            <CheckCircle size={36} />
          </div>
          <h2 className={styles.title}>¡Cuenta verificada!</h2>
          <p className={styles.description}>
            Tu dirección de correo electrónico ha sido confirmada con éxito. Ya tienes acceso completo al sistema.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className={styles.button}
          >
            Ir al Dashboard
          </button>
        </>
      )
    }

    if (status === "error") {
      return (
        <>
          <div className={`${styles.statusIconWrapper} ${styles.iconError}`}>
            <AlertCircle size={36} />
          </div>
          <h2 className={styles.title}>Error de verificación</h2>
          <p className={styles.description}>
            {errorMessage || "El enlace de verificación no es válido o ha expirado."}
          </p>
          
          <div className={styles.buttonGroup}>
            {accessToken ? (
              <button
                onClick={handleResend}
                disabled={isResending || resendCooldown > 0}
                className={styles.button}
              >
                {isResending ? (
                  <>
                    <Loader2 className={styles.spinner} size={16} style={{ marginRight: "0.5rem" }} />
                    Reenviando...
                  </>
                ) : resendCooldown > 0 ? (
                  `Reenviar en ${resendCooldown}s`
                ) : (
                  "Reenviar enlace de verificación"
                )}
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className={styles.button}
              >
                Iniciar sesión
              </button>
            )}
            
            <button
              onClick={() => router.push("/dashboard")}
              className={styles.buttonSecondary}
            >
              Ir al inicio
            </button>
          </div>
        </>
      )
    }

    // Estado Idle (cuando no hay token en la url)
    return (
      <>
        <div className={`${styles.statusIconWrapper} ${styles.iconLoading}`}>
          <Mail size={32} />
        </div>
        <h2 className={styles.title}>Confirma tu correo</h2>
        <p className={styles.description}>
          Hemos enviado un enlace de confirmación a tu dirección de correo electrónico:
          {user?.email && (
            <span className={styles.emailBadge}>{user.email}</span>
          )}
          <br />
          <br />
          Por favor, revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.
        </p>

        {resendSuccess && (
          <p style={{ color: "#10b981", fontSize: "0.875rem", marginBottom: "1rem", fontWeight: 500 }}>
            Se ha enviado un nuevo enlace de verificación.
          </p>
        )}

        {errorMessage && (
          <p style={{ color: "#ef4444", fontSize: "0.875rem", marginBottom: "1rem", fontWeight: 500 }}>
            {errorMessage}
          </p>
        )}

        <div className={styles.buttonGroup}>
          <button
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
            className={styles.button}
          >
            {isResending ? (
              <>
                <Loader2 className={styles.spinner} size={16} style={{ marginRight: "0.5rem" }} />
                Enviando...
              </>
            ) : resendCooldown > 0 ? (
              `Reenviar en ${resendCooldown}s`
            ) : (
              "Reenviar correo de verificación"
            )}
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className={styles.buttonSecondary}
          >
            Volver al Dashboard
          </button>
        </div>
      </>
    )
  }

  return (
    <AuthLayout>
      <AuthCard>
        {renderContent()}
        
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft size={16} />
          Volver
        </Link>
      </AuthCard>
    </AuthLayout>
  )
}
