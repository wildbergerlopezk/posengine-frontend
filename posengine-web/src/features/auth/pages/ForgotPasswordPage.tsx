import { ForgotPasswordForm } from "@/src/features/auth/components/ForgotPasswordForm"
import { AuthLayout, AuthCard } from "@/src/features/auth"

export function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <AuthCard title="Recuperar contraseña">
        <ForgotPasswordForm />
      </AuthCard>
    </AuthLayout>
  )
}
