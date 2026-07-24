import { Suspense } from "react"
import { VerifyEmailPage } from "@/src/features/auth/pages/VerifyEmailPage"

export default function Page() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <VerifyEmailPage />
    </Suspense>
  )
}
