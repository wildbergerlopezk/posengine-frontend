import { Suspense } from "react"
import { ResetPasswordForm } from "../components/ResetPasswordForm"
import { AuthLayout, AuthCard } from "@/src/features/auth"

export function ResetPasswordPage() {
  return (
    <AuthLayout>
      <AuthCard title="Nueva contraseña">
        <Suspense fallback={<div>Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </AuthCard>
    </AuthLayout>
  )
}
