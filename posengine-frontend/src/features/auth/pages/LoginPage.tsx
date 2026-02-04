import { LoginForm } from "../components/LoginForm"
import { ShoppingCart } from "lucide-react"
import styles from "./AuthLayout.module.css"

export function LoginPage() {
  return (
    <div className={styles.layout}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <ShoppingCart size={24} />
          </div>
          <span className={styles.logoText}>CloudPOS</span>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
