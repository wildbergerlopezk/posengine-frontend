import { HelpPage } from "@/src/features/help/pages/HelpPage"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Ayuda y Manual - PosEngine",
  description: "Manual de usuario y guía de funcionalidades del sistema PosEngine.",
}

export default function Page() {
  return <HelpPage />
}
