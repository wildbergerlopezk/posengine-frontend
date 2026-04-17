import { LoginForm } from "../components/LoginForm"
import styles from "./AuthLayout.module.css"

export function LoginPage() {
  return (
    <div className={styles.layout}>
      <div className={styles.content}>
        <div className={styles.logo}>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
