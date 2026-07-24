import { ForgotPasswordForm } from "@/src/features/auth/components/ForgotPasswordForm"
import styles from "./ForgotPassword.module.css"

export function ForgotPasswordPage() {
  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <div className={styles.brand}>
          Elytech
          <span className={styles.brandText}>
            POS<span className={styles.brandHighlight}>ENGINE</span>
          </span>
        </div>

        <h1>Recuperar contraseña</h1>

        <ForgotPasswordForm />
      </section>
    </main>
  )
}
