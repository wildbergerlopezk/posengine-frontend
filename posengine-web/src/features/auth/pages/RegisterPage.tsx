import { RegisterForm } from "../components/RegisterForm"
import { Settings } from "lucide-react"
import styles from "./AuthLayout.module.css"

export function RegisterPage() {
  return (
    <div className={styles.layout}>
      <div className={styles.content}>
        <RegisterForm />
      </div>
    </div>
  )
}

