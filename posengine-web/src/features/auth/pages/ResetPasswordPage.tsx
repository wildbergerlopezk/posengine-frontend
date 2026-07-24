import { Suspense } from "react"
import { ResetPasswordForm } from "../components/ResetPasswordForm"
import styles from "./ForgotPassword.module.css"

export function ResetPasswordPage() {
  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <div className={styles.brand}>
          Elytech
          <span className={styles.brandText}>
            POS<span className={styles.brandHighlight}>ENGINE</span>
          </span>
        </div>

        <h1>Nueva contraseña</h1>

        <Suspense fallback={<div>Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  )
}
