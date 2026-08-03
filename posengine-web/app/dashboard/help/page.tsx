import { HelpPage } from "@/src/features/help/pages/HelpPage"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Ayuda y Soporte - PosEngine",
  description: "Página de ayuda y soporte del sistema PosEngine.",
}

export default function Page() {
  return <HelpPage />
}
